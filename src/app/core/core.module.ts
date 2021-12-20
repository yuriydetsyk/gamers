import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule, Optional, SkipSelf, ErrorHandler } from '@angular/core';
import { AngularFireModule } from '@angular/fire';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFireAuthGuardModule } from '@angular/fire/auth-guard';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireStorageModule, BUCKET } from '@angular/fire/storage';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { take } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LoaderInterceptor } from './interceptors/loader.interceptor';
import { ProfilerInterceptor } from './interceptors/profiler.interceptor';
import { FirebaseService } from './services/firebase.service';
import { ErrorsHandler } from './handlers/errors.handler';

const ANGULAR_FIRE_MODULES = [
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireAuthGuardModule,
    AngularFireStorageModule
];

const INTERCEPTORS = [
    { provide: HTTP_INTERCEPTORS, useClass: LoaderInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ProfilerInterceptor, multi: true }
];

// AoT requires an exported function for factories
export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
    imports: [
        HttpClientModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: (createTranslateLoader),
                deps: [HttpClient]
            }
        }),
        ...ANGULAR_FIRE_MODULES
    ],
    providers: [
        {
            provide: APP_INITIALIZER,
            useFactory: (firebaseService: FirebaseService) =>
                () => {
                    // Method that retrieves session in the APP_INITIALIZER phase
                    return firebaseService.getAuthState()
                        .pipe(take(1))
                        .toPromise();
                },
            deps: [FirebaseService],
            multi: true
        },
        { provide: BUCKET, useValue: environment.firebase.storageBucket },
        { provide: ErrorHandler, useClass: ErrorsHandler },
        ...INTERCEPTORS
    ]
})
export class CoreModule {
    constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
        if (parentModule) {
            throw new Error(
                'CoreModule is already loaded. Import it in the AppModule only');
        }
    }
}
