import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { CustomerStakingRequestService, LabRegister } from './models';

@Injectable()
export class MailerManager {
  private readonly _logger: Logger = new Logger(MailerManager.name);
  constructor(private readonly mailerService: MailerService) {}

  async sendCustomerStakingRequestServiceEmail(
    to: string | string[],
    context: CustomerStakingRequestService,
  ) {
    this.mailerService.sendMail({
      to: to,
      subject: `New Service Request - ${context.service_name} - ${context.city}, ${context.state}, ${context.country}`,
      template: './customer-staking-request-service',
      context: context,
    });
  }

  async sendLabRegistrationEmail(to: string | string[], context: LabRegister) {
    const files: any[] = [];
    context.certifications.forEach((val, idx) => {
      files.push({
        filename: `Certifications Supporting Document ${idx + 1}`,
        path: val.supporting_document,
      });
    });
    context.services.forEach((val, idx) => {
      files.push({
        filename: `Services Supporting Document ${idx + 1}`,
        path: val.supporting_document,
      });
    });

    try {
      this.mailerService.sendMail({
        to: to,
        subject: `New Lab Register – ${context.lab_name} - ${context.city}, ${context.state}, ${context.country}`,
        template: './lab-register',
        context: {
          profile_image: context.profile_image,
          email: context.email,
          lab_name: context.lab_name,
          phone_number: context.phone_number,
          country: context.country,
          state: context.state,
          city: context.city,
          address: context.address,
          certifications: context.certifications,
          services: context.services,
        },
        attachments: files,
      });
      return true;
    } catch (error) {
      await this._logger.log(`Send Email Failed: ${error}`);
    }
  }
}
