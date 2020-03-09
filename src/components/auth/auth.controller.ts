import { Controller, Post, Body, Redirect, Get, Query } from '@nestjs/common';
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
    @Post('reset')
    async reset(@Body() input: ResetInput): Promise<boolean> {
        return this.authService.reset(input);
    }
    @Get('reset')
    async check(@Query('token') token: string): Promise<boolean> {
        if(this.authService.check(token)){
            Redirect("url?token="+token);
            return true;
        }
        return false;
    }
}