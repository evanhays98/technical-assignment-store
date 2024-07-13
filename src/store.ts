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

export function Restrict(permission?: Permission): any {
    return function (target: any, key: string) {
        if (!target.__permissions__) {
            target.__permissions__ = {};
        }
        target.__permissions__[key] = permission;
    };
}

export class Store implements IStore {
    private readonly data: Record<string, StoreValue> = {};
    private readonly permissions: Record<string, Permission> = {};
    defaultPolicy: Permission = "rw";

    constructor() {
        const prototypes = Object.getPrototypeOf(this);
        this.permissions = prototypes.__permissions__;
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
        const mainPath = splitPath[0]
        let currentValue = this.data[splitPath[0]];
        if (!this.allowedToRead(path)) {
            throw new Error("Permission denied");
        }
        return currentValue as StoreResult;
    }

    write(path: string, value: StoreValue): StoreValue {
        if (typeof value === "function") {
            value = value();
        }
        if (!this.allowedToWrite(path)) {
            throw new Error("Permission denied");
        }
        this.data[path] = value;
        return value;
    }

    writeEntries(entries: JSONObject): void {
        throw new Error("Method not implemented.");
    }

    entries(): JSONObject {
        throw new Error("Method not implemented.");
    }
}