// Data layer barrel export (MASTER-12)
// New code should import { repository } from '@/data' and use it
// instead of calling storageGet/storageSet directly.

export type { DataRepository } from './repository';
export { AsyncStorageRepository } from './asyncStorageRepository';

import { AsyncStorageRepository } from './asyncStorageRepository';
import type { DataRepository } from './repository';

export const repository: DataRepository = new AsyncStorageRepository();
