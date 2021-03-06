/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { leastCommonInterval } from 'ui/vis/lib/least_common_interval';
import { isValidEsInterval } from '../../../common';

/**
 * Check a string if it's a valid JSON.
 *
 * @param {string} value a string that should be validated
 * @returns {boolean} true if value is a valid JSON or if value is an empty string, or a string with whitespaces, otherwise false
 */
export function isValidJson(value: string): boolean {
  if (!value || value.length === 0) {
    return true;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return true;
  }

  if (trimmedValue[0] === '{' || trimmedValue[0] === '[') {
    try {
      JSON.parse(trimmedValue);
      return true;
    } catch (e) {
      return false;
    }
  } else {
    return false;
  }
}

export function isValidInterval(value: string, baseInterval?: string) {
  if (baseInterval) {
    return _parseWithBase(value, baseInterval);
  } else {
    return isValidEsInterval(value);
  }
}

// When base interval is set, check for least common interval and allow
// input the value is the same. This means that the input interval is a
// multiple of the base interval.
function _parseWithBase(value: string, baseInterval: string) {
  try {
    const interval = leastCommonInterval(baseInterval, value);
    return interval === value.replace(/\s/g, '');
  } catch (e) {
    return false;
  }
}

// An inlined version of angular.toJSON()
// source: https://github.com/angular/angular.js/blob/master/src/Angular.js#L1312
// @internal
export function toAngularJSON(obj: any, pretty?: any): string {
  if (obj === undefined) return '';
  if (typeof pretty === 'number') {
    pretty = pretty ? 2 : null;
  }
  return JSON.stringify(obj, toJsonReplacer, pretty);
}

function isWindow(obj: any) {
  return obj && obj.window === obj;
}

function isScope(obj: any) {
  return obj && obj.$evalAsync && obj.$watch;
}

function toJsonReplacer(key: any, value: any) {
  let val = value;

  if (typeof key === 'string' && key.charAt(0) === '$' && key.charAt(1) === '$') {
    val = undefined;
  } else if (isWindow(value)) {
    val = '$WINDOW';
  } else if (value && window.document === value) {
    val = '$DOCUMENT';
  } else if (isScope(value)) {
    val = '$SCOPE';
  }

  return val;
}
