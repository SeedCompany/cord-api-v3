import { DiscoveredMethodWithMeta } from '@golevelup/nestjs-discovery';

export const uniqueDiscoveredMethods = <T>(
  methods: Array<DiscoveredMethodWithMeta<T>>,
) => {
  const seenClasses = new Map<object, Map<string, Set<unknown>>>();
  const uniqueMethods = [] as typeof methods;
  for (const method of methods) {
    const clsInstance = method.discoveredMethod.parentClass.instance;
    const methodName = method.discoveredMethod.methodName;
    if (!seenClasses.has(clsInstance)) {
      seenClasses.set(clsInstance, new Map());
    }
    const seenMethods = seenClasses.get(clsInstance)!;
    if (!seenMethods.has(methodName)) {
      seenMethods.set(methodName, new Set());
    }
    const seenMetadata = seenMethods.get(methodName)!;
    if (!seenMetadata.has(method.meta)) {
      seenMetadata.add(method.meta);
      uniqueMethods.push(method);
    }
  }
  return uniqueMethods;
};
