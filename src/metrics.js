const config = require('./config');
const os = require('os');

class MetricBuilder {
    constructor() {
        this._strings = [];
    }

    append(metricPrefix, metricName, metricValue) {
        const metric = `${metricPrefix},source=${config.metrics.source} ${metricName}=${metricValue}`;
        this._strings.push(metric);
        return this;
    }

    toString(delim = '\n') {
        return this._strings.join(delim);
    }
}

class Metrics {
    constructor()
    {
        this.requests = { total: 0, GET: 0, PUT: 0, POST: 0, DELETE: 0 };
        this.activeUsers = new Set();
        this.authAttempts = { successful: 0, failed: 0 };
        this.pizzaMetrics = { sold: 0, failed: 0, revenue: 0 };
        this.latencyMetrics = { service: 0, pizza: 0 };
    }

    requestTracker(req, res, next) {
        this.requests.total++;
        if (req.method in this.requests) {
            this.requests[req.method]++;
        }
        next();
    }

    trackAuthAttempt(success) {
        success ? this.authAttempts.success++ : this.authAttempts.failed++;
    }

    trackActiveUser(userId) {
        this.activeUsers.add(userId);
    }

    trackPizzaSale(amount, revenue) {
        this.pizzaMetrics.sold += amount;
        this.pizzaMetrics.revenue += revenue;
    }

    trackPizzaFailure() {
        this.pizzaMetrics.failures++;
    }

    trackLatency(type, duration) {
        if (!this.latencyMetrics[type]) {
            this.latencyMetrics[type] = [];
        }
        this.latencyMetrics[type].push(duration);
    }

    getCpuUsagePercentage() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length;
        return cpuUsage.toFixed(2) * 100;
    }

    getMemoryUsagePercentage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;
        return memoryUsage.toFixed(2);
    }

    sendMetricToGrafana(metricName, metricValue, type, unit) {
        const metric = {
            resourceMetrics: [
                {
                    scopeMetrics: [
                        {
                            metrics: [
                                {
                                    name: metricName,
                                    unit: unit,
                                    [type]: {
                                        dataPoints: [
                                            {
                                                asInt: metricValue,
                                                timeUnixNano: Date.now() * 1000000,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        if (type === 'sum') {
            metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
            metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
        }

        const body = JSON.stringify(metric);
        fetch(`${config.url}`, {
            method: 'POST',
            body: body,
            headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        })
        .then((response) => {
            if (!response.ok) {
                response.text().then((text) => {
                    console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
                });
            } else {
                console.log(`Pushed ${metricName}`);
            }
        })
        .catch((error) => {
            console.error('Error pushing metrics:', error);
        });
    }   

    sendMetricsPeriodically(period) {
        setInterval(() => {
            try {
                const buf = new MetricBuilder();
                this.httpMetrics(buf);
                this.systemMetrics(buf);
                this.userMetrics(buf);
                this.purchaseMetrics(buf);
                this.authMetrics(buf);

                const metrics = buf.toString('\n');
                this.sendMetricToGrafana(metrics);
            } catch (error) {
                console.log('Error sending metrics', error);
            }
        }, period);
    }

    httpMetrics(buf) {
        buf.append('pizza_http_request', 'total', this.requests.total);
        buf.append('pizza_http_latency', 'service', this.latencyMetrics.service);
    }

    systemMetrics(buf) {
        buf.append('pizza_system_cpu', 'percent', this.getCpuUsagePercentage());
        buf.append('pizza_system_memory', 'used', this.getMemoryUsagePercentage());
    }

    userMetrics(buf) {
        buf.append('pizza_user_count', 'total', this.activeUsers.size);
    }

    purchaseMetrics(buf) {
        buf.append('pizza_purchase_sold', 'total', this.pizzaMetrics.sold);
        buf.append('pizza_purchase_revenue', 'total', this.pizzaMetrics.revenue);
        buf.append('pizza_purchase_failed', 'total', this.pizzaMetrics.failed);
    }

    authMetrics(buf) {
        buf.append('pizza_auth_success', 'total', this.authAttempts.successful);
        buf.append('pizza_auth_failure', 'total', this.authAttempts.failed);
    }
}

module.exports = new Metrics();

