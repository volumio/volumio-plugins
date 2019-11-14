export declare type Predicate<T> = (value: T) => boolean;
export declare type KeyValuePair<T> = [string, T];
/**
 * Stellt einen Polyfill für Object.entries bereit
 * @param obj Das Objekt, dessen Eigenschaften als Key-Value-Pair iteriert werden sollen
 */
export declare function entries<T>(obj: Record<string, T>): KeyValuePair<T>[];
/**
 * Stellt einen Polyfill für Object.values bereit
 * @param obj Das Objekt, dessen Eigenschaftswerte iteriert werden sollen
 */
export declare function values<T>(obj: Record<string, T>): T[];
/**
 * Gibt ein Subset eines Objekts zurück, dessen Eigenschaften einem Filter entsprechen
 * @param obj Das Objekt, dessen Eigenschaften gefiltert werden sollen
 * @param predicate Die Filter-Funktion, die auf Eigenschaften angewendet wird
 */
export declare function filter<T>(obj: Record<string, T>, predicate: Predicate<T>): Record<string, T>;
/**
 * Kopiert Eigenschaften rekursiv von einem Objekt auf ein anderes
 * @param target - Das Zielobjekt, auf das die Eigenschaften übertragen werden sollen
 * @param source - Das Quellobjekt, aus dem die Eigenschaften kopiert werden sollen
 */
export declare function extend<T1 extends Record<string, any>, T2 extends Record<string, any>>(target: T1, source: T2): Record<string, any>;
