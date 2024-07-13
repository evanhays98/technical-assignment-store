import {JSONArray, JSONObject, JSONPrimitive} from "./json-types";

export type Permission = "r" | "w" | "rw" | "none";

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
    | JSONObject
    | JSONArray
    | StoreResult
    | (() => StoreResult);

export interface IStore {
    defaultPolicy: Permission;

    allowedToRead(key: string): boolean;

    allowedToWrite(key: string): boolean;

    read(path: string): StoreResult;

    write(path: string, value: StoreValue): StoreValue;

    writeEntries(entries: JSONObject): void;

    entries(): JSONObject;
}

function flattenEntries(entries: JSONObject): Record<string, JSONPrimitive | JSONArray> {
    const result: Record<string, JSONPrimitive | JSONArray> = {};

    const flatten = (obj: JSONObject, parentKey = '') => {
        for (const key in obj) {
            const fullKey = parentKey ? `${parentKey}:${key}` : key;
            if (typeof obj[key] === 'object' && obj[key]) {
                flatten(obj[key] as JSONObject, fullKey);
            } else {
                result[fullKey] = obj[key] as JSONPrimitive | JSONArray;
            }
        }
    };

    flatten(entries);
    return result;
}

export function Restrict(permission?: Permission): any {
    return function (target: any, key: string) {
        if (!target.__permissions__) {
            target.__permissions__ = {};
        }
        target.__permissions__[key] = permission;

        const store = target as Store;
        Object.defineProperty(store, key, {
            get() {
                return this.read(key);
            },
            set(value: StoreValue) {
                if (!this.data[key]) {
                    const permission = this.permissions[key]
                    this.permissions[key] = "w";
                    const res = this.write(key, value);
                    this.permissions[key] = permission;
                    return res;
                }
                return this.write(key, value);
            },
        });
    };
}

export class Store implements IStore {
    private readonly data: Record<string, StoreValue> = {};
    private readonly permissions: Record<string, Permission> = {};
    defaultPolicy: Permission = "rw";

    constructor() {
        const prototypes = Object.getPrototypeOf(this);
        this.permissions = prototypes.__permissions__ || {};
        this.defaultPolicy = "rw";
        this.data = {};
    }

    allowedToRead(key: string): boolean {
        const permission = this.permissions[key] || this.defaultPolicy;
        return permission.includes("r");
    }

    allowedToWrite(key: string): boolean {
        const permission = this.permissions[key] || this.defaultPolicy;
        return permission.includes("w");
    }

    read(path: string): StoreResult {
        const splitPath = path.split(":");
        const mainKey = splitPath[0]
        let currentValue = this.data[mainKey];

        if (currentValue instanceof Store) {
            return currentValue.read(splitPath.slice(1, splitPath.length).join(':'));
        }

        for (let i = 1; i < splitPath.length; i++) {
            const key = splitPath[i];
            if (!currentValue || typeof currentValue !== "object" || Array.isArray(currentValue)) {
                if (!this.defaultPolicy.includes("r")) {
                    throw new Error("Permission denied");
                }
                return undefined;
            }
            currentValue = currentValue[key];
        }

        if (!this.allowedToRead(path)) {
            throw new Error("Permission denied");
        }
        return currentValue as StoreResult;
    }

    write(path: string, value: StoreValue): StoreValue {
        if (!value) {
            throw new Error("Value must be provided");
        }

        const splitPath = path.split(":");
        let currentValue: any = this.data;

        // loop on path to find the correct object to write to
        for (let i = 0; i < splitPath.length - 1; i++) {
            const key = splitPath[i];

            // if the current value is a store, call write on it
            if (currentValue instanceof Store) {
                return currentValue.write(splitPath.slice(i, splitPath.length).join(':'), value);
            }

            if (!currentValue[key] || typeof currentValue[key] !== "object") {
                currentValue[key] = {};
            }
            currentValue = currentValue[key];
        }

        const finalKey = splitPath[splitPath.length - 1];

        if (!this.allowedToWrite(path)) {
            throw new Error("Permission denied");
        }

        currentValue[finalKey] = value;

        return value;
    }

    writeEntries(entries: JSONObject): void {
        const flatEntries = flattenEntries(entries);
        for (const key in flatEntries) {
            this.write(key, flatEntries[key]);
        }
    }

    entries(): JSONObject {
        throw new Error("Method not implemented.");
    }
}