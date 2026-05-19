import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type PublicUser } from './auth.service';
import { type SignupDto, signupSchema } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    signup(
        @Body(new ZodValidationPipe(signupSchema)) dto: SignupDto,
    ): Promise<PublicUser> {
        return this.authService.signup(dto);
    }
}
