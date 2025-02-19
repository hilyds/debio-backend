import { GeneticAnalysisService } from '../../../../../src/endpoints/substrate-endpoint/services';
import { elasticsearchServiceMockFactory, MockType } from '../../../mock';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Test, TestingModule } from '@nestjs/testing';
import { when } from 'jest-when';

describe('Substrate Indexer Genetic Analysis Service Unit Testing', () => {
  let geneticAnalysisServiceMock: GeneticAnalysisService;
  let elasticsearchServiceMock: MockType<ElasticsearchService>;

  const createSearchObject = (genetic_analysis_tracking_id: string) => {
    return {
      index: 'genetic-analysis',
      body: {
        query: {
          match: {
            genetic_analysis_tracking_id: {
              query: genetic_analysis_tracking_id,
            },
          },
        },
      },
    };
  };

  //Arrange before each iteration
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneticAnalysisService,
        {
          provide: ElasticsearchService,
          useFactory: elasticsearchServiceMockFactory,
        },
      ],
    }).compile();

    geneticAnalysisServiceMock = module.get(GeneticAnalysisService);
    elasticsearchServiceMock = module.get(ElasticsearchService);
  });

  it('should be defined', () => {
    //Assert
    expect(geneticAnalysisServiceMock).toBeDefined();
  });

  it('should find genetic analysis by hash id', () => {
    // Arrange
    const CALLED_WITH = createSearchObject('XX');
    const RESULT = {};
    const ES_RESULT = {
      body: {
        hits: {
          hits: RESULT,
        },
      },
    };
    when(elasticsearchServiceMock.search)
      .calledWith(CALLED_WITH)
      .mockReturnValue(ES_RESULT);

    //Assert
    expect(
      geneticAnalysisServiceMock.getGeneticAnalysisByTrackingId('XX'),
    ).resolves.toEqual(RESULT);
    expect(elasticsearchServiceMock.search).toHaveBeenCalled();
  });

  it('should return empty', () => {
    //Arrange
    const RESULT = {};
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

    //Assert
    expect(
      geneticAnalysisServiceMock.getGeneticAnalysisByTrackingId('XX'),
    ).resolves.toEqual(RESULT);
    expect(elasticsearchServiceMock.search).toHaveBeenCalled();
  });

  it('should throw error', () => {
    //Arrange
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

    //Assert
    expect(
      geneticAnalysisServiceMock.getGeneticAnalysisByTrackingId('XX'),
    ).rejects.toMatchObject(ERROR_RESULT);
    expect(elasticsearchServiceMock.search).toHaveBeenCalled();
  });
});
