import projectTranslation from "./project/th.json";

type ExtractVars<S extends string> =
    S extends `${string}{{${infer Var}}}${infer Rest}`
    ? Var | ExtractVars<Rest>
    : never;

type VarsForValue<V> = V extends string
    ? ExtractVars<V> extends never
    ? {}
    : { [K in ExtractVars<V>]: string }
    : V extends object
    ? { [K in keyof V]: VarsForValue<V[K]> }
    : {};

type KeyPathsWithVars<T, Prev extends string = ""> = {
    [K in keyof T]: T[K] extends string
    ? Prev extends ""
    ? { key: K; vars: VarsForValue<T[K]> }
    : { key: `${Prev}.${K & string}`; vars: VarsForValue<T[K]> }
    : T[K] extends object
    ? KeyPathsWithVars<T[K], Prev extends "" ? K & string : `${Prev}.${K & string}`>
    : never
}[keyof T];

type Flatten<T> = T extends any ? T : never;

type AllKeyVars = Flatten<KeyPathsWithVars<typeof projectTranslation>>;

export type TranslationKey = AllKeyVars["key"];

type VarsForKey<K extends TranslationKey> =
    Extract<AllKeyVars, { key: K }>["vars"] extends infer V ? V extends object ? V : {} : {};

export type TFunction = <K extends TranslationKey>(
    key: K,
    options?: VarsForKey<K>
) => string;

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "translation";
        resources: {
            translation: typeof projectTranslation;
        };
        returnNull: false;
        returnObjects: true;
    }

    interface TFunction {
        <K extends TranslationKey>(key: K, options?: VarsForKey<K>): string;
    }
}
