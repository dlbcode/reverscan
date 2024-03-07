import { appState } from '../stateManager.js';
import { buildSingleDateTable } from './singleDateTable.js';
import { buildDateRangeTable } from './rangeDateTable.js';

function buildRouteTable(routeIndex) {
  const dateRange = appState.routeDates[routeIndex + 1];
  if (dateRange && dateRange.includes(' to ')) {
    buildDateRangeTable(routeIndex, dateRange);
  } else {
    buildSingleDateTable(routeIndex, dateRange);
  }
}

export { buildRouteTable };