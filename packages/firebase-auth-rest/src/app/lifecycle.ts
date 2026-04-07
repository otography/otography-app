/*!
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as validator from "../utils/validator";
import { AppErrorCodes, FirebaseAppError } from "../utils/error";
import { App, AppOptions } from "./core";
import { FirebaseApp } from "./firebase-app";

const DEFAULT_APP_NAME = "[DEFAULT]";

export class AppStore {
  private readonly appStore = new Map<string, FirebaseApp>();

  public initializeApp(options?: AppOptions, appName: string = DEFAULT_APP_NAME): App {
    validateAppNameFormat(appName);

    if (typeof options === "undefined") {
      throw new FirebaseAppError(
        AppErrorCodes.INVALID_APP_OPTIONS,
        "initializeApp() requires options with a credential property.",
      );
    }

    // Check if an app already exists and, if so, ensure its `AppOptions` match
    // those of this `initializeApp` request.
    if (!this.appStore.has(appName)) {
      const app = new FirebaseApp(options, appName, false, this);
      this.appStore.set(app.name, app);
      return app;
    }

    const currentApp = this.appStore.get(appName)!;

    // `FirebaseApp()` adds a synthesized `Credential` to `app.options` upon
    // app construction. Run a comparison w/o `Credential` to see if the base
    // configurations match. Return the existing app if so.
    const currentAppOptions = { ...currentApp.options };
    delete currentAppOptions.credential;
    const requestedOptions = { ...options };
    delete requestedOptions.credential;
    if (JSON.stringify(requestedOptions) !== JSON.stringify(currentAppOptions)) {
      throw new FirebaseAppError(
        AppErrorCodes.DUPLICATE_APP,
        `A Firebase app named "${appName}" already exists with a different configuration.`,
      );
    }

    return currentApp;
  }

  public getApp(appName: string = DEFAULT_APP_NAME): App {
    validateAppNameFormat(appName);
    if (!this.appStore.has(appName)) {
      let errorMessage: string =
        appName === DEFAULT_APP_NAME
          ? "The default Firebase app does not exist. "
          : `Firebase app named "${appName}" does not exist. `;
      errorMessage +=
        "Make sure you call initializeApp() before using any of the Firebase services.";

      throw new FirebaseAppError(AppErrorCodes.NO_APP, errorMessage);
    }

    return this.appStore.get(appName)!;
  }

  public getApps(): App[] {
    // Return a copy so the caller cannot mutate the array
    return Array.from(this.appStore.values());
  }

  public async deleteApp(app: App): Promise<void> {
    if (typeof app !== "object" || app === null || !("options" in app)) {
      throw new FirebaseAppError(AppErrorCodes.INVALID_ARGUMENT, "Invalid app argument.");
    }

    // Make sure the given app already exists.
    const existingApp = this.getApp(app.name);

    // Delegate delete operation to the App instance itself. That will also remove the App
    // instance from the AppStore.
    await (existingApp as FirebaseApp).delete();
  }

  public async clearAllApps(): Promise<void> {
    const promises: Array<Promise<void>> = [];
    this.getApps().forEach((app) => {
      promises.push(this.deleteApp(app));
    });

    await Promise.all(promises);
  }

  /**
   * Removes the specified App instance from the store. This is currently called by the
   * {@link FirebaseApp.delete} method.
   */
  public removeApp(appName: string): void {
    this.appStore.delete(appName);
  }
}

/**
 * Checks to see if the provided appName is a non-empty string and throws if it
 * is not.
 */
function validateAppNameFormat(appName: string): void {
  if (!validator.isNonEmptyString(appName)) {
    throw new FirebaseAppError(
      AppErrorCodes.INVALID_APP_NAME,
      `Invalid Firebase app name "${String(appName)}" provided. App name must be a non-empty string.`,
    );
  }
}

export const defaultAppStore = new AppStore();

export function initializeApp(options?: AppOptions, appName: string = DEFAULT_APP_NAME): App {
  return defaultAppStore.initializeApp(options, appName);
}

export function getApp(appName: string = DEFAULT_APP_NAME): App {
  return defaultAppStore.getApp(appName);
}

export function getApps(): App[] {
  return defaultAppStore.getApps();
}

export async function deleteApp(app: App): Promise<void> {
  await defaultAppStore.deleteApp(app);
}
