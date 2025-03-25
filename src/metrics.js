const config = require('./config');
const os = require('os');

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

    trackAuthAttempt(successful) {
        if (successful) {
            this.authAttempts.successful++;
        }
        else {
            this.authAttempts.failed++;
        }
    }

    trackActiveUser(userId) {
        this.activeUsers.add(userId);
    }

    trackPizzaSale(amount, revenue) {
        this.pizzaMetrics.sold += amount;
        this.pizzaMetrics.revenue += revenue;
    }

    trackPizzaFailure() {
        this.pizzaMetrics.failed++;
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
                this.sendMetricToGrafana('pizza_http_request_total', this.requests.total, 'sum', 'count');
                this.sendMetricToGrafana('pizza_http_latency_service', this.latencyMetrics.service.length ? this.latencyMetrics.service.reduce((a, b) => a + b, 0) / this.latencyMetrics.service.length : 0, 'gauge', 'ms');
                this.sendMetricToGrafana('pizza_system_cpu', this.getCpuUsagePercentage(), 'gauge', 'percent');
                this.sendMetricToGrafana('pizza_system_memory', this.getMemoryUsagePercentage(), 'gauge', 'percent');
                this.sendMetricToGrafana('pizza_user_count', this.activeUsers.size, 'gauge', 'count');
                this.sendMetricToGrafana('pizza_purchase_sold', this.pizzaMetrics.sold, 'sum', 'count');
                this.sendMetricToGrafana('pizza_purchase_revenue', this.pizzaMetrics.revenue, 'sum', 'currency');
                this.sendMetricToGrafana('pizza_purchase_failed', this.pizzaMetrics.failed, 'sum', 'count');
                this.sendMetricToGrafana('pizza_auth_success', this.authAttempts.successful, 'sum', 'count');
                this.sendMetricToGrafana('pizza_auth_failure', this.authAttempts.failed, 'sum', 'count');
            } catch (error) {
                console.error('Error sending metrics:', error);
            }
        }, period);
    }
}

module.exports = new Metrics();

