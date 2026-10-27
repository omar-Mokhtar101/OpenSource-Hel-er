import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  DiscoveryQuerySchema,
  IgnoreIssueSchema,
  RecommendationRequestSchema,
  type IgnoreIssue,
  type RecommendationRequest,
} from '@osh/contracts';
import { CurrentUser, type RequestUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/decorators';
import { DiscoveryService } from './discovery.service';
import { SelectionService } from '../selection/selection.service';

@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly selection: SelectionService,
  ) {}

  @Get('issues')
  @Roles('DEVELOPER')
  search(@CurrentUser() user: RequestUser, @Query() query: unknown) {
    const filters = DiscoveryQuerySchema.parse(query ?? {});
    return this.discovery.search(user.id, filters, filters.page, filters.perPage);
  }

  @Get('issues/:id/context')
  @Roles('DEVELOPER')
  context(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.discovery.issueContext(user.id, decodeURIComponent(id));
  }

  @Get('issues/:id')
  @Roles('DEVELOPER')
  details(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.discovery.issue(user.id, decodeURIComponent(id));
  }

  @Post('recommendations')
  @Roles('DEVELOPER')
  recommend(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const input: RecommendationRequest = RecommendationRequestSchema.parse(body ?? {});
    return this.discovery.recommend(user.id, input, false);
  }

  @Post('recommendations/regenerate')
  @Roles('DEVELOPER')
  regenerate(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const input: RecommendationRequest = RecommendationRequestSchema.parse(body ?? {});
    return this.discovery.recommend(user.id, input, true);
  }

  @Get('recommendations/latest')
  @Roles('DEVELOPER')
  latest(@CurrentUser() user: RequestUser) {
    return this.discovery.latest(user.id);
  }

  @Post('ignore')
  @Roles('DEVELOPER')
  ignore(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const input: IgnoreIssue = IgnoreIssueSchema.parse(body);
    return this.selection.ignore(user.id, input.issueId);
  }
}
