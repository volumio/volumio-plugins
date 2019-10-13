"use strict";
/** @module helpers */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Asserts that all possible cases of a value have been checked
 * @param value The value to check for exhaustiveness
 */
function assertNever(value) {
    throw new Error(`Unexpected value observed: ${value}`);
}
exports.assertNever = assertNever;
