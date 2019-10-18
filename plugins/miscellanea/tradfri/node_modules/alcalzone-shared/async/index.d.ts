/** @module async */
export declare function promisify<T>(fn: Function, context?: any): (...args: any[]) => Promise<T>;
export declare function promisifyNoError<T>(fn: Function, context?: any): (...args: any[]) => Promise<T>;
/** Creates a promise that waits for the specified time and then resolves */
export declare function wait(ms: number): Promise<void>;
export declare type PromiseFactory<T> = () => Promise<T>;
/**
 * Executes the given promise-returning functions in sequence
 * @param promiseFactories An array of promise-returning functions
 * @returns An array containing all return values of the executed promises
 */
export declare function promiseSequence<T>(promiseFactories: Iterable<PromiseFactory<T>>): Promise<T[]>;
