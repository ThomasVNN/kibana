/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import Hapi from 'hapi';

import { DETECTION_ENGINE_RULES_URL } from '../../../../../common/constants';
import { LegacyServices, LegacyRequest } from '../../../../types';
import { GetScopedClients } from '../../../../services';
import { findRulesStatusesSchema } from '../schemas/find_rules_statuses_schema';
import {
  FindRulesStatusesRequest,
  IRuleSavedAttributesSavedObjectAttributes,
  RuleStatusResponse,
  IRuleStatusAttributes,
} from '../../rules/types';
import { ruleStatusSavedObjectType } from '../../rules/saved_object_mappings';
import { transformError, convertToSnakeCase } from '../utils';

export const createFindRulesStatusRoute = (getClients: GetScopedClients): Hapi.ServerRoute => ({
  method: 'GET',
  path: `${DETECTION_ENGINE_RULES_URL}/_find_statuses`,
  options: {
    tags: ['access:siem'],
    validate: {
      options: {
        abortEarly: false,
      },
      query: findRulesStatusesSchema,
    },
  },
  async handler(request: FindRulesStatusesRequest & LegacyRequest, headers) {
    const { query } = request;
    const { alertsClient, savedObjectsClient } = await getClients(request);

    if (!alertsClient) {
      return headers.response().code(404);
    }

    // build return object with ids as keys and errors as values.
    /* looks like this
        {
            "someAlertId": [{"myerrorobject": "some error value"}, etc..],
            "anotherAlertId": ...
        }
    */
    try {
      const statuses = await query.ids.reduce<Promise<RuleStatusResponse | {}>>(async (acc, id) => {
        const lastFiveErrorsForId = await savedObjectsClient.find<
          IRuleSavedAttributesSavedObjectAttributes
        >({
          type: ruleStatusSavedObjectType,
          perPage: 6,
          sortField: 'statusDate',
          sortOrder: 'desc',
          search: id,
          searchFields: ['alertId'],
        });
        const accumulated = await acc;

        // Array accessors can result in undefined but
        // this is not represented in typescript for some reason,
        // https://github.com/Microsoft/TypeScript/issues/11122
        const currentStatus = convertToSnakeCase<IRuleStatusAttributes>(
          lastFiveErrorsForId.saved_objects[0]?.attributes
        );
        const failures = lastFiveErrorsForId.saved_objects
          .slice(1)
          .map(errorItem => convertToSnakeCase<IRuleStatusAttributes>(errorItem.attributes));
        return {
          ...accumulated,
          [id]: {
            current_status: currentStatus,
            failures,
          },
        };
      }, Promise.resolve<RuleStatusResponse>({}));
      return statuses;
    } catch (err) {
      const error = transformError(err);
      return headers
        .response({
          message: error.message,
          status_code: error.statusCode,
        })
        .code(error.statusCode);
    }
  },
});

export const findRulesStatusesRoute = (
  route: LegacyServices['route'],
  getClients: GetScopedClients
): void => {
  route(createFindRulesStatusRoute(getClients));
};
