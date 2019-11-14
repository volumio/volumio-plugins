"use strict";
/** @module math */
Object.defineProperty(exports, "__esModule", { value: true });
/** limits a value to the range given by min/max */
function clamp(value, min, max) {
    if (min > max) {
        [min, max] = [max, min];
    }
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
exports.clamp = clamp;
function roundTo(value, digits) {
    const exp = Math.pow(10, digits);
    return Math.round(value * exp) / exp;
}
exports.roundTo = roundTo;
