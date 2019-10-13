"use strict";
/** @module async */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
function promisify(fn, context) {
    return function (...args) {
        // @ts-ignore We want this behavior
        context = context || this;
        return new Promise((resolve, reject) => {
            fn.apply(context, [...args, (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    else {
                        return resolve(result);
                    }
                }]);
        });
    };
}
exports.promisify = promisify;
function promisifyNoError(fn, context) {
    return function (...args) {
        // @ts-ignore We want this behavior
        context = context || this;
        return new Promise((resolve) => {
            fn.apply(context, [...args, (result) => {
                    return resolve(result);
                }]);
        });
    };
}
exports.promisifyNoError = promisifyNoError;
// tslint:enable:ban-types
/** Creates a promise that waits for the specified time and then resolves */
function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
exports.wait = wait;
/**
 * Executes the given promise-returning functions in sequence
 * @param promiseFactories An array of promise-returning functions
 * @returns An array containing all return values of the executed promises
 */
function promiseSequence(promiseFactories) {
    return __awaiter(this, void 0, void 0, function* () {
        const ret = [];
        for (const f of promiseFactories) {
            ret.push(yield f());
        }
        return ret;
    });
}
exports.promiseSequence = promiseSequence;
