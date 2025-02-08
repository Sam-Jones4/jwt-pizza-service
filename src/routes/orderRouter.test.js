const request = require('supertest');
const app = require('../service');


const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let adminUser;
let adminUserAuthToken;
let testMenuItem = { title: 'Pepperoni', description: 'good', image: 'pizza9.png', price: 1 };
let testNewOrder = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }] };

beforeAll(async () => {
    adminUser = await createAdminUser();
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    console.log(loginRes.body)
    adminUserAuthToken = loginRes.body.token;
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

//My tests
test('get pizza menu', async () => {
    const getMenuRes = await request(app).get('/api/order/menu');

    expect(getMenuRes.status).toBe(200);
    expect(Array.isArray(getMenuRes.body)).toBe(true);
});

test('add item to menu', async () => {
    const addItemRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminUserAuthToken}`).send(testMenuItem);

    expect(addItemRes.status).toBe(200);
    expect(addItemRes.body).toContainEqual(expect.objectContaining(testMenuItem));
});


test('get orders for authenticated user', async () => {
    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
});


test('create order for authenticated user', async () => {
    const createOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send(testNewOrder);

    expect(createOrderRes.status).toBe(200);
    expect(createOrderRes.body.order).toMatchObject(testNewOrder);
});
