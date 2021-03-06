// @flow

import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import request from 'request';
import type { Logger, IPluginMiddleware, IBasicAuth, IStorageManager } from '@verdaccio/types';
import type { ConfigAudit, $RequestExtend, $ResponseExtend } from '../types';

export default class ProxyAudit implements IPluginMiddleware {
  enabled: boolean;
  logger: Logger;

  constructor(config: ConfigAudit, options: any) {
    this.enabled = config.enabled || false;
  }

  register_middlewares(app: any, auth: IBasicAuth, storage: IStorageManager) {
    const fetchAudit = (req: $RequestExtend, res: $ResponseExtend) => {
      const requestCallback = function(err, _res, body) {
        if (err) {
          res.status(500).end();
        }
        res.send(body);
      };

      const headers = req.headers;
      headers.host = 'https://registry.npmjs.org/';
      const fetchAu = request(
        {
          url: 'https://registry.npmjs.org/-/npm/v1/security/audits',
          method: 'POST',
          proxy: auth.config.https_proxy,
          req,
          body: JSON.stringify(req.body),
          gzip: true,
          strictSSL: true
        },
        requestCallback
      );

      return fetchAu;
    };

    const handleAudit = (req: $RequestExtend, res: $ResponseExtend) => {
      if (this.enabled) {
        fetchAudit(req, res);
      } else {
        res.status(500).end();
      }
    };

    const hasJsonContentType = (req: $RequestExtend) => {
      const contentMediaType = req.headers['content-type'];
      return contentMediaType && typeof contentMediaType === 'string' && contentMediaType.includes('application/json');
    };

    /* eslint new-cap:off */
    const router = express.Router();
    /* eslint new-cap:off */
    router.use(compression());
    router.use(bodyParser.json({ strict: false, limit: '50mb', type: hasJsonContentType }));
    router.post('/audits', handleAudit);

    router.post('/audits/quick', handleAudit);

    app.use('/-/npm/v1/security', router);
  }
}
