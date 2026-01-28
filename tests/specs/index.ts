import { TestSpec } from '../types';
import { functionalSpecs } from './functional';
import { boundarySpecs } from './boundary';
import { stressSpecs } from './stress';

// Combine all specs - add new spec files here
export const specs: TestSpec[] = [
  ...functionalSpecs,
  ...boundarySpecs,
  ...stressSpecs,
];

export { functionalSpecs, boundarySpecs, stressSpecs };
