/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import Boom from 'boom';
import _ from 'lodash';
import { i18n } from '@kbn/i18n';

import { schema } from '@kbn/config-schema';
import { SecurityPluginSetup } from '../../../security/server';
import { isAnnotationsFeatureAvailable } from '../lib/check_annotations';
import { annotationServiceProvider } from '../models/annotation_service';
import { wrapError } from '../client/error_wrapper';
import { licensePreRoutingFactory } from './license_check_pre_routing_factory';
import { RouteInitialization } from '../types';
import {
  deleteAnnotationSchema,
  getAnnotationsSchema,
  indexAnnotationSchema,
} from './schemas/annotations_schema';

import { ANNOTATION_USER_UNKNOWN } from '../../../../legacy/plugins/ml/common/constants/annotations';

function getAnnotationsFeatureUnavailableErrorMessage() {
  return Boom.badRequest(
    i18n.translate('xpack.ml.routes.annotations.annotationsFeatureUnavailableErrorMessage', {
      defaultMessage:
        'Index and aliases required for the annotations feature have not been' +
        ' created or are not accessible for the current user.',
    })
  );
}
/**
 * Routes for annotations
 */
export function annotationRoutes(
  { router, getLicenseCheckResults }: RouteInitialization,
  securityPlugin: SecurityPluginSetup
) {
  /**
   * @apiGroup Annotations
   *
   * @api {post} /api/ml/annotations Gets annotations
   * @apiName GetAnnotations
   * @apiDescription Gets annotations.
   *
   * @apiParam {String[]} jobIds List of job IDs
   * @apiParam {String} earliestMs
   * @apiParam {Number} latestMs
   * @apiParam {Number} maxAnnotations Max limit of annotations returned
   *
   * @apiSuccess {Boolean} success
   * @apiSuccess {Object} annotations
   */
  router.post(
    {
      path: '/api/ml/annotations',
      validate: {
        body: schema.object(getAnnotationsSchema),
      },
    },
    licensePreRoutingFactory(getLicenseCheckResults, async (context, request, response) => {
      try {
        const { getAnnotations } = annotationServiceProvider(context);
        const resp = await getAnnotations(request.body);

        return response.ok({
          body: resp,
        });
      } catch (e) {
        return response.customError(wrapError(e));
      }
    })
  );

  /**
   * @apiGroup Annotations
   *
   * @api {put} /api/ml/annotations/index Index annotation
   * @apiName IndexAnnotations
   * @apiDescription Index the annotation.
   *
   * @apiParam {Object} annotation
   * @apiParam {String} username
   */
  router.put(
    {
      path: '/api/ml/annotations/index',
      validate: {
        body: schema.object(indexAnnotationSchema),
      },
    },
    licensePreRoutingFactory(getLicenseCheckResults, async (context, request, response) => {
      try {
        const annotationsFeatureAvailable = await isAnnotationsFeatureAvailable(
          context.ml!.mlClient.callAsCurrentUser
        );
        if (annotationsFeatureAvailable === false) {
          throw getAnnotationsFeatureUnavailableErrorMessage();
        }

        const { indexAnnotation } = annotationServiceProvider(context);
        const user = securityPlugin.authc.getCurrentUser(request) || {};
        // @ts-ignore username doesn't exist on {}
        const resp = await indexAnnotation(request.body, user.username || ANNOTATION_USER_UNKNOWN);

        return response.ok({
          body: resp,
        });
      } catch (e) {
        return response.customError(wrapError(e));
      }
    })
  );

  /**
   * @apiGroup Annotations
   *
   * @api {delete} /api/ml/annotations/index Deletes annotation
   * @apiName DeleteAnnotation
   * @apiDescription Deletes specified annotation
   *
   * @apiParam {String} annotationId
   */
  router.delete(
    {
      path: '/api/ml/annotations/delete/{annotationId}',
      validate: {
        params: schema.object(deleteAnnotationSchema),
      },
    },
    licensePreRoutingFactory(getLicenseCheckResults, async (context, request, response) => {
      try {
        const annotationsFeatureAvailable = await isAnnotationsFeatureAvailable(
          context.ml!.mlClient.callAsCurrentUser
        );
        if (annotationsFeatureAvailable === false) {
          throw getAnnotationsFeatureUnavailableErrorMessage();
        }

        const annotationId = request.params.annotationId;
        const { deleteAnnotation } = annotationServiceProvider(context);
        const resp = await deleteAnnotation(annotationId);

        return response.ok({
          body: resp,
        });
      } catch (e) {
        return response.customError(wrapError(e));
      }
    })
  );
}
