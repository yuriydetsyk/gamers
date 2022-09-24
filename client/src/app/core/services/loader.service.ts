import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LoaderService {
    private pendingRequestsCount = 0;
    private pendingProcessesCount = 0;
    public isLoading = new BehaviorSubject<boolean>(false);

    public addRequest() {
        this.pendingRequestsCount++;
        this.isLoading.next(true);
    }

    public addProcess() {
        this.pendingProcessesCount++;
        this.isLoading.next(true);
    }

    public removeRequest() {
        this.pendingRequestsCount--;
        this.isLoading.next(this.pendingRequestsCount > 0 || this.pendingProcessesCount > 0);
    }

    public removeProcess() {
        this.pendingProcessesCount--;
        this.isLoading.next(this.pendingRequestsCount > 0 || this.pendingProcessesCount > 0);
    }
}
