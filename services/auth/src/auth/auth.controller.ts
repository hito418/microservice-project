import {
    type AuthServiceController,
    AuthServiceControllerMethods,
    type LoginRequest,
    type LoginResponse,
    loginSchema,
    type SignupRequest,
    type SignupResponse,
    signupSchema,
} from '@contracts/auth';
import { Controller } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { ZodRpcValidationPipe } from '@repo/common/pipes';
import { AuthService } from './auth.service';

@Controller()
@AuthServiceControllerMethods()
export class AuthController implements AuthServiceController {
    constructor(private readonly authService: AuthService) {}

    signup(
        @Payload(new ZodRpcValidationPipe(signupSchema)) data: SignupRequest,
    ): Promise<SignupResponse> {
        return this.authService.signup(data);
    }

    login(
        @Payload(new ZodRpcValidationPipe(loginSchema)) data: LoginRequest,
    ): Promise<LoginResponse> {
        return this.authService.login(data);
    }
}
