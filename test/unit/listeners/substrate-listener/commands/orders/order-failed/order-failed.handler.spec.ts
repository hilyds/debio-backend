import { SubstrateService } from '../../../../../../../src/common';
import { OrderCreatedCommand } from '../../../../../../../src/listeners/substrate-listener/commands/orders';
import { Test, TestingModule } from '@nestjs/testing';
import {
  createMockOrder,
  escrowServiceMockFactory,
  mockBlockNumber,
  MockType,
  substrateServiceMockFactory,
} from '../../../../../mock';
import { OrderStatus } from '@debionetwork/polkadot-provider';
import { OrderFailedHandler } from '../../../../../../../src/listeners/substrate-listener/commands/orders/order-failed/order-failed.handler';
import { EscrowService } from '../../../../../../../src/common/modules/escrow/escrow.service';
import * as ordersCommand from '@debionetwork/polkadot-provider/lib/command/labs/orders';

describe('Order Failed Handler Event', () => {
  let orderFailedHandler: OrderFailedHandler;
  let substrateServiceMock: MockType<SubstrateService>;
  let escrowServiceMock: MockType<EscrowService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SubstrateService,
          useFactory: substrateServiceMockFactory,
        },
        {
          provide: EscrowService,
          useFactory: escrowServiceMockFactory,
        },
        OrderFailedHandler,
      ],
    }).compile();

    orderFailedHandler = module.get(OrderFailedHandler);
    substrateServiceMock = module.get(SubstrateService);
    escrowServiceMock = module.get(EscrowService);

    await module.init();
  });

  it('should defined Order Failed Handler', () => {
    expect(orderFailedHandler).toBeDefined();
  });

  it('should called refunded order if failed', async () => {
    // Arrange
    const refundedOrderSpy = jest
      .spyOn(ordersCommand, 'setOrderRefunded')
      .mockImplementation();
    const ORDER = createMockOrder(OrderStatus.Cancelled);

    const orderCancelledCommand: OrderCreatedCommand = new OrderCreatedCommand(
      [ORDER],
      mockBlockNumber(),
    );

    await orderFailedHandler.execute(orderCancelledCommand);
    expect(escrowServiceMock.refundOrder).toHaveBeenCalled();
    expect(escrowServiceMock.refundOrder).toHaveBeenCalledWith(
      orderCancelledCommand.orders.id,
    );
    expect(refundedOrderSpy).toHaveBeenCalled();
    expect(refundedOrderSpy).toHaveBeenCalledWith(
      substrateServiceMock.api,
      substrateServiceMock.pair,
      orderCancelledCommand.orders.id,
    );
  });
});
