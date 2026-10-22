import { LocationStrategy, PathLocationStrategy } from "@angular/common";
import { NO_ERRORS_SCHEMA, NgModule } from "@angular/core";

// Imports
import { AppRoutingModule } from "src/app/app-routing.module";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { provideHttpClient, withInterceptorsFromDi, withXhr } from "@angular/common/http";
import { MaterialModule } from "src/app/modules/material.module";
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from "@angular/material/form-field";
import { SharedModule } from "src/app/components/shared/shared.module";

// Declarations
import { AdminMediaComponent } from "src/app/components/admin-media/admin-media.component";
import { AppComponent } from "src/app/app.component";
import { AuthActionComponent } from "src/app/components/auth-action/auth-action.component";
import { AuthComponent } from "src/app/components/auth/auth.component";
import { ChatComponent } from "src/app/components/chat/chat.component";
import { ChatEditComponent } from "src/app/components/chat-edit/chat-edit.component";
import { ChatViewComponent } from "src/app/components/chat-view/chat-view.component";
import { PromptModalComponent } from "src/app/components/prompt-modal/prompt-modal.component";
import { ConfirmDialogComponent } from "src/app/components/confirm-dialog/confirm-dialog.component";
import { RecoveryRequestComponent } from "src/app/components/recovery-request/recovery-request.component";
import { ContactCardComponent } from "src/app/components/contacts/contact-card/contact-card.component";
import { ContactEditComponent } from "src/app/components/contacts/contact-edit/contact-edit.component";
import { ContactViewComponent } from "src/app/components/contacts/contact-view/contact-view.component";
import { ContactsComponent } from "src/app/components/contacts/contacts.component";
import { FileInputComponent } from "src/app/components/file-input/file-input.component";
import { PhotoUploadProgressComponent } from "src/app/components/photo-upload-progress/photo-upload-progress.component";
import { PhotoShellComponent } from "src/app/components/photo-shell/photo-shell.component";
import { PhotoAlbumsComponent } from "src/app/components/photo-albums/photo-albums.component";
import { PhotoAlbumDetailComponent } from "src/app/components/photo-album-detail/photo-album-detail.component";
import { PhotoSlideshowComponent } from "src/app/components/photo-slideshow/photo-slideshow.component";
import { PhotosLegacyComponent } from "src/app/components/photos-legacy/photos-legacy.component";
import { AdminMediaUploadAudioAlbumComponent } from "src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component";
import { UserViewComponent } from "./components/user-view/user-view.component";
import { UserEditComponent } from "./components/user-edit/user-edit.component";
import { AdminMediaUploadVideoComponent } from "./components/admin-media-upload-video/admin-media-upload-video.component";
import { NavbarLinksComponent } from "./components/navbar-links/navbar-links.component";
import { FeatureDisabledComponent } from "./components/feature-disabled/feature-disabled.component";
import { ExpressionsComponent } from "./components/expressions/expressions.component";
import { ExpressionViewComponent } from "src/app/components/expression-view/expression-view.component";
import { ExpressionEditComponent } from "./components/expression-edit/expression-edit.component";
import { PeopleComponent } from "./components/people/people.component";
import { LvLoadErrorComponent } from "src/app/components/load-error/load-error.component";
import { NoResultsMessageComponent } from "./components/no-results-message/no-results-message.component";
import { PageToolbarComponent } from "./components/shared/page-toolbar/page-toolbar.component";

@NgModule({ declarations: [
        AdminMediaComponent,
        AppComponent,
        AuthComponent,
        ChatComponent,
        ChatEditComponent,
        ChatViewComponent,
        PromptModalComponent,
        ConfirmDialogComponent,
        ContactCardComponent,
        ContactEditComponent,
        ContactViewComponent,
        ContactsComponent,
        FileInputComponent,
        PhotoShellComponent,
        PhotoAlbumsComponent,
        PhotoAlbumDetailComponent,
        PhotoSlideshowComponent,
        PhotosLegacyComponent,
        AdminMediaUploadAudioAlbumComponent,
        FeatureDisabledComponent,
        UserViewComponent,
        UserEditComponent,
        AdminMediaUploadVideoComponent,
        NavbarLinksComponent,
        ExpressionsComponent,
        ExpressionViewComponent,
        ExpressionEditComponent,
        PeopleComponent,
        AuthActionComponent,
        RecoveryRequestComponent,
    ],
    schemas: [NO_ERRORS_SCHEMA],
    bootstrap: [AppComponent],
    exports: [ContactEditComponent], imports: [AppRoutingModule,
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        MaterialModule,
        SharedModule,
        // Standalone components used in templates of module-declared components.
        LvLoadErrorComponent,
        NoResultsMessageComponent,
        PageToolbarComponent,
        PhotoUploadProgressComponent,
        ReactiveFormsModule], providers: [{ provide: LocationStrategy, useClass: PathLocationStrategy }, provideHttpClient(withXhr(), withInterceptorsFromDi()), { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: "outline" } }] })
export class AppModule {}
