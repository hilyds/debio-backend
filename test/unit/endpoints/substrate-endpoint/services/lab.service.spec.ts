import { Test, TestingModule } from '@nestjs/testing';
import { when } from 'jest-when';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { LabService } from '../../../../../src/endpoints/substrate-endpoint/services/lab.service';
import { elasticsearchServiceMockFactory, MockType } from '../../../mock';

describe('Substrate Indexer Lab Service Unit Tests', () => {
  let labServiceMock: LabService;
  let elasticsearchServiceMock: MockType<ElasticsearchService>;

  const createSearchObject = (
    country: string,
    region: string,
    city: string,
    category: string,
    service_flow: boolean,
    page: number,
    size: number,
  ) => {
    return {
      index: 'labs',
      body: {
        query: {
          bool: {
            must: [
              {
                match_phrase_prefix: { 'services.country': { query: country } },
              },
              { match_phrase_prefix: { 'services.region': { query: region } } },
              { match_phrase_prefix: { 'services.city': { query: city } } },
              {
                match_phrase_prefix: {
                  'services.info.category': { query: category },
                },
              },
              {
                match_phrase_prefix: {
                  'services.service_flow': { query: service_flow },
                },
              },
            ],
          },
        },
      },
      from: (size * page - size) | 0,
      size: size | 10,
    };
  };

  // Arrange before each iteration
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabService,
        {
          provide: ElasticsearchService,
          useFactory: elasticsearchServiceMockFactory,
        },
      ],
    }).compile();

    labServiceMock = module.get(LabService);
    elasticsearchServiceMock = module.get(ElasticsearchService);
  });

  it('should be defined', () => {
    // Assert
    expect(labServiceMock).toBeDefined();
  });

  it('should find lab by country, city, and category', async () => {
    // Arrange
    const CALLED_WITH = createSearchObject(
      'XX',
      'XX',
      'XX',
      'XX',
      false,
      1,
      10,
    );
    const ES_RESULT = {
      body: {
        hits: {
          hits: [
            {
              _source: {
                certifications: 'cert',
                verification_status: false,
                blockMetaData: 1,
                account_id: 'ID',
                info: {
                  category: 'XX',
                },
                stake_amount: '20',
                stake_status: 'string',
                unstake_at: 'string',
                retrieve_unstake_at: 'string',
                services: [
                  {
                    info: {
                      category: 'XX',
                    },
                    service_flow: false,
                  },
                ],
              },
            },
          ],
        },
      },
    };
    when(elasticsearchServiceMock.search)
      .calledWith(CALLED_WITH)
      .mockReturnValue(ES_RESULT);

    const RESULT = {
      result: [
        {
          lab_id: 'ID',
          info: {
            category: 'XX',
          },
          stake_amount: '20',
          stake_status: 'string',
          unstake_at: 'string',
          retrieve_unstake_at: 'string',
          lab_detail: {
            category: 'XX',
          },
          certifications: 'cert',
          verification_status: false,
          service_flow: false,
          blockMetaData: 1,
        },
      ],
    };

    // Assert
    expect(
      await labServiceMock.getByCountryCityCategory(
        'XX',
        'XX',
        'XX',
        'XX',
        false,
        1,
        10,
      ),
    ).toEqual(RESULT);
    expect(elasticsearchServiceMock.search).toHaveBeenCalled();
  });

  it('should return empty', () => {
    // Arrange
    const RESULT = [];
    const ERROR_RESULT = {
      body: {
        error: {
          type: 'index_not_found_exception',
        },
      },
    };
    elasticsearchServiceMock.search.mockImplementationOnce(() =>
      Promise.reject(ERROR_RESULT),
    );

    // Assert
    expect(
      labServiceMock.getByCountryCityCategory(
        'XX',
        'XX',
        'XX',
        'XX',
        false,
        1,
        10,
      ),
    ).resolves.toEqual({
      result: RESULT,
    });
    expect(elasticsearchServiceMock.search).toHaveBeenCalled();
  });

  it('should throw error', () => {
    // Arrange
    const ERROR_RESULT = {
      body: {
        error: {
          type: 'failed',
        },
      },
    };
    elasticsearchServiceMock.search.mockImplementationOnce(() =>
      Promise.reject(ERROR_RESULT),
    );

    // Assert
    expect(
      labServiceMock.getByCountryCityCategory(
        'XX',
        'XX',
        'XX',
        'XX',
        false,
        1,
        10,
      ),
    ).rejects.toMatchObject(ERROR_RESULT);
    expect(elasticsearchServiceMock.search).toHaveBeenCalled();
  });
});
