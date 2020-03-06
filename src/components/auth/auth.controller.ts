import { Controller, Post, Body, Redirect, Get, Param, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService, UserEmailInput } from '../user';
import { ResetInput } from './auth.dto';

@Controller('auth')
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
    @Get('reset')
    async reset(@Query() input: ResetInput): Promise<boolean> {
        return this.authService.reset(input);
    }
}