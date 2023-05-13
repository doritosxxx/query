function oldHashFn(queryKey: readonly unknown[]): string {
    function hasObjectPrototype(o: any): boolean {
        return Object.prototype.toString.call(o) === '[object Object]'
    }

    function isPlainObject(o: any): o is Object {
        if (!hasObjectPrototype(o)) {
          return false
        }
      
        // If has modified constructor
        const ctor = o.constructor
        if (typeof ctor === 'undefined') {
          return true
        }
      
        // If has modified prototype
        const prot = ctor.prototype
        if (!hasObjectPrototype(prot)) {
          return false
        }
      
        // If constructor does not have an Object-specific method
        if (!prot.hasOwnProperty('isPrototypeOf')) {
          return false
        }
      
        // Most likely a plain Object
        return true
    }

    return JSON.stringify(queryKey, (_, val) =>
      isPlainObject(val)
        ? Object.keys(val)
            .sort()
            .reduce((result, key) => {
              result[key] = val[key]
              return result
            }, {} as any)
        : val,
    )
}

const newHashFn = (key: string) => key;

describe('old hashing function test', () => {
    it("should collide with null and undefined", () => {
        const keys = [
            undefined, 
            null, 
            NaN, 
            Infinity, 
            -Infinity, 
            Symbol("some string"), 
            Symbol("some another string")
        ];
        const hashes = keys.map(key => oldHashFn([key]));

        // All hashes are equal.
        for(const hash of hashes){
            expect(hash).toEqual(hashes[0]);
        }
    });
});

describe('performance test', () => {
    const key = ["this", "is", {
        "some": ["overcomplicated", "query"],
        "key": {
            1: 2,
            3: 4,
        }
    }] as const;

    const hashFn = (value: typeof key) => value.map(item => typeof item === "string" ? item : Object.entries(item).map(([key, value]) => `${key},${Object.keys(value).join(",")}`)).join("/");


    it("should hash 10_000 keys with old hash function", () => {
        for(let i = 0; i < 10_000; ++i){
            const hash = oldHashFn(key);
        }
    });

    it("should hash 10_000 keys with new approach", () => {
        for(let i = 0; i < 10_000; ++i){
            const hash = hashFn(key);
        }
    });

    it("should hash 1_000_000 keys with old hash function", () => {
        for(let i = 0; i < 1_000_000; ++i){
            const hash = oldHashFn(key);
        }
    });

    it("should hash 1_000_000 keys with new approach", () => {
        for(let i = 0; i < 1_000_000; ++i){
            const hash = hashFn(key);
        }
    });
});

describe('memory consumtion test', () => {
    const key = ["this", "is", {
        "some": ["overcomplicated", "query"],
        "key": {
            1: 2,
            3: 4,
        }
    }] as const;

    const hashFn = (value: typeof key) => value.map(item => typeof item === "string" ? item : Object.entries(item).map(([key, value]) => `${key},${Object.keys(value).join(",")}`)).join("/");

    test("hash length difference", () => {
        const oldHash = oldHashFn(key);
        const newHash = hashFn(key);
    
        expect(newHash.length).toBeLessThan(oldHash.length);
    
        console.log(`old hash length: ${oldHash.length}`);
        console.log(`new hash length: ${newHash.length}`);
        console.log(`${oldHash.length/newHash.length} times less`);
    });
});