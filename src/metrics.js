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
        console.log(this.authAttempts);
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
        // console.log(memoryUsage.toFixed(2));
        return memoryUsage.toFixed(2);
    }

    sendMetricToGrafana(metricName, metricValue, type, unit) {
        // console.table({metricName, metricValue, type, unit})
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
                                                asDouble: metricValue,
                                                timeUnixNano: Date.now() * 1000000,
                                                attributes: [
                                                    {
                                                        key: "source",
                                                        value: { "stringValue": config.metrics.source }
                                                    }
                                                ]
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
        fetch(`${config.metrics.url}`, {
            method: 'POST',
            body: body,
            headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
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
                this.sendMetricToGrafana('http_total_requests', this.requests.total, 'sum', '1');
                this.sendMetricToGrafana('http_get_requests', this.requests.GET, 'sum', '1');
                this.sendMetricToGrafana('http_put_requests', this.requests.PUT, 'sum', '1');
                this.sendMetricToGrafana('http_post_requests', this.requests.POST, 'sum', '1');
                this.sendMetricToGrafana('http_delete_requests', this.requests.DELETE, 'sum', '1');
                this.sendMetricToGrafana('http_latency', this.latencyMetrics.service.length ? this.latencyMetrics.service.reduce((a, b) => a + b, 0) / this.latencyMetrics.service.length : 0, 'histogram', 'ms');
                this.sendMetricToGrafana('active_users', this.activeUsers.size, 'sum', '1');
                this.sendMetricToGrafana('auth_success', this.authAttempts.successful, 'sum', '1');
                this.sendMetricToGrafana('auth_failure', this.authAttempts.failed, 'sum', '1');
                this.sendMetricToGrafana('cpu_usage', this.getCpuUsagePercentage(), 'gauge', '%');
                this.sendMetricToGrafana('memory_usage', this.getMemoryUsagePercentage(), 'gauge', '%');
                this.sendMetricToGrafana('pizzas_sold', this.pizzaMetrics.sold, 'sum', '1');
                this.sendMetricToGrafana('pizza_revenue', this.pizzaMetrics.revenue, 'sum', '1');
                this.sendMetricToGrafana('pizza_failed', this.pizzaMetrics.failed, 'sum', '1');
                this.sendMetricToGrafana('pizza_latency', this.latencyMetrics.pizza.length ? this.latencyMetrics.pizza.reduce((a, b) => a + b, 0) / this.latencyMetrics.pizza.length : 0, 'sum', 'ms');
            } catch (error) {
                console.error('Error sending metrics:', error);
            }
        }, period);
    }
}

module.exports = new Metrics();

