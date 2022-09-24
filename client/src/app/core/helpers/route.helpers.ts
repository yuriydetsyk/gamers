import { ActivatedRouteSnapshot } from '@angular/router';
import { isNil } from './type.helpers';
import { LayoutData } from '../../models/interfaces/layout-data.interface';

function getFullRouteData(routeSnapshot: ActivatedRouteSnapshot) {
    const routeTree = [routeSnapshot.data];

    if (routeSnapshot.firstChild) {
        routeTree.unshift(...getFullRouteData(routeSnapshot.firstChild));
    }

    return routeTree;
}

function getLayoutData(routeSnapshot: ActivatedRouteSnapshot) {
    let showHeader;
    let showSidebar;
    let showFooter;

    const fullRouteData = getFullRouteData(routeSnapshot);
    for (const routeData of fullRouteData) {
        if (isNil(showHeader)) {
            showHeader = routeData.showHeader;
        }
        if (isNil(showSidebar)) {
            showSidebar = routeData.showSidebar;
        }
        if (isNil(showFooter)) {
            showFooter = routeData.showFooter;
        }
    }

    return { showHeader, showSidebar, showFooter } as LayoutData;
}

export { getFullRouteData, getLayoutData };
