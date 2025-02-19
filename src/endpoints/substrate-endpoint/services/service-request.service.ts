import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { CountryService } from '../../location/country.service';
import { DebioConversionService } from '../../../common/modules/debio-conversion/debio-conversion.service';

interface RequestsByCountry {
  country: string;
  totalRequests: number;
  totalValue: string;
}

@Injectable()
export class ServiceRequestService {
  private logger: Logger = new Logger(ServiceRequestService.name);
  constructor(
    @Inject(forwardRef(() => CountryService))
    private countryService: CountryService,
    private readonly elasticsearchService: ElasticsearchService,
    private exchangeCacheService: DebioConversionService,
  ) {}

  async getAggregatedByCountries(
    page: number,
    size: number,
  ): Promise<Array<RequestsByCountry>> {
    const requestByCountryList: Array<RequestsByCountry> = [];

    let startIndex = 0;
    let endIndex = 0;

    try {
      const exchangeBalance = await this.exchangeCacheService.getExchange();
      const serviceRequests = await this.elasticsearchService.search({
        index: 'create-service-request',
        body: {
          query: {
            bool: {
              must: {
                match: {
                  'request.status': { query: 'Open' },
                },
              },
            },
          },
          from: 0,
          size: 10000,
          sort: [
            {
              'request.country.keyword': {
                unmapped_type: 'keyword',
                order: 'asc',
              },
            },
          ],
        },
      });

      const {
        body: {
          hits: { hits },
        },
      } = serviceRequests;
      const oneDbioEqualToDai = exchangeBalance?.dbioToDai || undefined;
      const oneDbioEqualToUsd = exchangeBalance?.dbioToUsd || undefined;

      // Accumulate totalRequests and totalValue by country
      const requestByCountryDict = {};
      for (const req of hits) {
        const {
          _source: { request },
        } = req;

        if (!requestByCountryDict[request.country]) {
          requestByCountryDict[request.country] = {
            totalRequests: 0,
            totalValue: 0,
            services: {},
          };

          endIndex++;
        }

        const value =
          Number(request.staking_amount.split(',').join('')) / 10 ** 18;
        requestByCountryDict[request.country].totalRequests += 1;
        const currValueByCountry = Number(
          requestByCountryDict[request.country].totalValue,
        );
        requestByCountryDict[request.country].totalValue =
          currValueByCountry + value;

        if (
          !requestByCountryDict[request.country]['services'][
            request.region + '-' + request.city + '-' + request.service_category
          ]
        ) {
          requestByCountryDict[request.country]['services'][
            request.region + '-' + request.city + '-' + request.service_category
          ] = {
            category: request.service_category,
            regionCode: request.region,
            city: request.city,
            totalRequests: 0,
            totalValue: {
              dbio: 0,
              dai: 0,
              usd: 0,
            },
          };
        }

        requestByCountryDict[request.country]['services'][
          request.region + '-' + request.city + '-' + request.service_category
        ].totalRequests += 1;
        const currValueByCountryServiceCategoryDai = Number(
          requestByCountryDict[request.country]['services'][
            request.region + '-' + request.city + '-' + request.service_category
          ].totalValue.dbio,
        );

        requestByCountryDict[request.country]['services'][
          request.region + '-' + request.city + '-' + request.service_category
        ].totalValue.dbio = currValueByCountryServiceCategoryDai + value;
      }

      if (page && size) {
        startIndex = (page - 1) * size;
        endIndex = startIndex + (size - 1);
      }

      // Restructure data into array
      let index = 0;

      for (const countryCode in requestByCountryDict) {
        if (index >= startIndex && index <= endIndex) {
          const countryObj = await this.countryService.getByIso2Code(
            countryCode,
          );
          if (!countryObj) {
            continue;
          }
          requestByCountryDict[countryCode]['totalValue'] = {
            dbio: requestByCountryDict[countryCode]['totalValue'],
            dai:
              requestByCountryDict[countryCode]['totalValue'] *
                oneDbioEqualToDai || 'Conversion Error',
            usd:
              requestByCountryDict[countryCode]['totalValue'] *
                oneDbioEqualToUsd || 'Conversion Error',
          };
          const { name } = countryObj;
          const { totalRequests, services } = requestByCountryDict[countryCode];
          const { totalValue } = requestByCountryDict[countryCode];

          const servicesArr = Object.values(services).map((s: any) => ({
            ...s,
            totalValue: {
              dbio: s.totalValue.dbio,
              dai: s.totalValue.dbio * oneDbioEqualToDai || 'Conversion Error',
              usd: s.totalValue.dbio * oneDbioEqualToUsd || 'Conversion Error',
            },
          }));

          const requestByCountry = {
            countryId: countryCode,
            country: name,
            totalRequests,
            totalValue,
            services: servicesArr,
          };

          requestByCountryList.push(requestByCountry);
        }
        index++;
      }
    } catch (error) {
      if (error?.body?.error?.type === 'index_not_found_exception') {
        await this.logger.log(
          `API "service-requests/countries": ${error.body.error.reason}`,
        );
      } else {
        throw error;
      }
    }
    return requestByCountryList;
  }

  async getByCustomerId(customerId: string, page: number, size: number) {
    const searchObj = {
      index: 'create-service-request',
      body: {
        query: {
          bool: {
            must: [
              {
                match_phrase_prefix: {
                  'request.requester_address': { query: customerId },
                },
              },
            ],
          },
        },
      },
      from: size * page - size || 0,
      size: size || 10,
    };

    const result = [];
    try {
      const requestServiceByCustomers = await this.elasticsearchService.search(
        searchObj,
      );

      requestServiceByCustomers.body.hits.hits.forEach((requestService) => {
        result.push(requestService._source);
      });
    } catch (error) {
      if (error?.body?.error?.type === 'index_not_found_exception') {
        await this.logger.log(
          `API "service-requests/customer/{customerId}": ${error.body.error.reason}`,
        );
      } else {
        throw error;
      }
    }
    return result;
  }

  async provideRequestService(
    country: string,
    region: string,
    city: string,
    category: string,
  ) {
    const searchObj = {
      index: 'create-service-request',
      body: {
        query: {
          bool: {
            must: [
              {
                match_phrase_prefix: { 'request.country': { query: country } },
              },
              { match_phrase_prefix: { 'request.region': { query: region } } },
              { match_phrase_prefix: { 'request.city': { query: city } } },
              {
                match_phrase_prefix: {
                  'request.service_category': { query: category },
                },
              },
              { match_phrase_prefix: { 'request.status': { query: 'Open' } } },
            ],
          },
        },
      },
    };

    const result = [];
    try {
      const requestServiceByCustomers = await this.elasticsearchService.search(
        searchObj,
      );

      requestServiceByCustomers.body.hits.hits.forEach((requestService) => {
        result.push(requestService._source);
      });
    } catch (error) {
      if (error?.body?.error?.type === 'index_not_found_exception') {
        await this.logger.log(
          `API "service-requests/provideRequestService": ${error.body.error.reason}`,
        );
      } else {
        throw error;
      }
    }
    return result;
  }
}
