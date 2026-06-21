import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { SearchService, type SearchResult } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Search tasks by title or description within projects the caller can access.',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiOkResponse({ description: 'Matching tasks (max 50), access-scoped.' })
  search(
    @CurrentUser() user: CurrentUserPayload,
    @Query('q') q = '',
  ): Promise<SearchResult[]> {
    return this.searchService.search(user, q);
  }
}
