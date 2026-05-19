import {
    type AuthServiceController,
    AuthServiceControllerMethods,
    type SignupRequest,
    type SignupResponse,
    signupSchema,
} from '@contracts/auth';
import { Controller } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

@Controller()
@AuthServiceControllerMethods()
export class AuthController implements AuthServiceController {
    constructor(private readonly authService: AuthService) {}

    signup(
        @Payload(new ZodValidationPipe(signupSchema)) data: SignupRequest,
    ): Promise<SignupResponse> {
        return this.authService.signup(data);
    }
}
