/** @module sorted-list */
import { Comparer } from "../comparable";
/**
 * A list that automatically sorts its items to guarantee that they are always in order
 */
export declare class SortedList<T> {
    private readonly comparer;
    private first;
    private last;
    private _length;
    readonly length: number;
    /**
     * Creates a new empty sorted list
     */
    constructor();
    /**
     * Creates a new sorted list from the given items
     * @param source Some items to initially add to the list
     */
    constructor(source: Iterable<T>);
    /**
     * Creates a new sorted list
     * @param source Some items to initially add to the list or undefined to create an empty list
     * @param comparer A comparer method used to sort items of a special
     * type. Not necessary for numbers, strings and Comparable<T>
     */
    constructor(source: Iterable<T> | undefined | null, comparer: Comparer<T>);
    /** Inserts new items into the sorted list and returns the new length */
    add(...items: T[]): number;
    /** Adds a single item to the list */
    private addOne;
    /** Removes items from the sorted list and returns the new length */
    remove(...items: T[]): number;
    /** Removes a single item from the list */
    private removeOne;
    /** Returns the item at the given index */
    get(index: number): T | undefined;
    /** Removes the first item from the list and returns it */
    shift(): T | undefined;
    /** Returns the first item from the list without removing it */
    peekStart(): T | undefined;
    /** Removes the last item from the list and returns it */
    pop(): T | undefined;
    /** Returns the last item from the list without removing it */
    peekEnd(): T | undefined;
    /** Removes a specific node from the list */
    private removeNode;
    /** Tests if the given item is contained in the list */
    contains(item: T): boolean;
    /** Returns the first item matching the given predicate */
    find(predicate: (item: T) => boolean): T | undefined;
    /** Returns the first item matching the given predicate */
    private findNodeForItem;
    /** Removes all items from the list */
    clear(): void;
    [Symbol.iterator](): IterableIterator<T>;
    /** Flattens this list into an array */
    toArray(): T[];
}
