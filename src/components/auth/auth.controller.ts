import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService, UserEmailInput } from '../user';

@Controller('recovery')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly userService: UserService,
    ) {}
    @Post('forget')
    async forget(@Body() input: UserEmailInput): Promise<boolean> {
        if(await this.userService.checkEmail(input))
            return false;
        return this.authService.forget(input)
    }
}