//@ts-nocheck
import { Big } from '../big';

export function checkIntegerSumOfAllocations(
  allocations: typeof Big[] | string[] | BigInt[],
  totalInput: typeof Big | string | BigInt
) {
  var totalInput = new Big(totalInput);
  var allocations: Big[] | string[] | BigInt[] = allocations.map(
    (item: Big | string | BigInt) => new Big(item).round()
  );
  let alloSum = allocations
    .map((item) => new Big(item))
    .reduce((a, b) => a.plus(b), new Big(0));
  let offset = totalInput.minus(alloSum);
  //get largest allocation.
  let currMax = new Big(0);
  let currMaxInd = 0;
  for (var i = 0; i < allocations.length; i++) {
    if (allocations[i].gt(currMax)) {
      currMaxInd = i;
      currMax = allocations[i];
    }
  }
  let newAllocations = [];
  for (var j = 0; j < allocations.length; j++) {
    if (j === currMaxInd) {
      newAllocations.push(allocations[j].plus(offset).toString());
    } else {
      newAllocations.push(allocations[j].toString());
    }
  }
  return newAllocations;
}
