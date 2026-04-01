import { getRouteFromId } from "./main.js";

export const ClimbStore = {
  routes: [],

  setRoutes(sqlResult, append = false) {
    if (!sqlResult || !sqlResult[0]) return [];

    const columns = sqlResult[0].columns;
    const values = sqlResult[0].values;

    const newRoutes = values.map(row => {
      let obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });

    if (append) {
      this.routes = [...this.routes, ...newRoutes];
    } else {
      this.routes = newRoutes;
    }

    return newRoutes;
  },

  addRoute(sqlResult) {
    const columns = sqlResult[0].columns;
    const values = sqlResult[0].values[0];

    const route = {};
    columns.forEach((col, i) => route[col] = values[i]);

    const index = this.routes.findIndex(r => r.uuid === route.uuid);

    if (index !== -1) {
      this.routes[index] = { ...this.routes[index], ...route };
    } else {
      this.routes.push(route);
    }

    return route;
  },
  getRouteByUuid(uuid) {
    getRouteFromId(uuid);
    return this.routes.find(r => r.uuid === uuid);
  },

  getAll() {
    return this.routes;
  }
};