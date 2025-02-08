const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testFranchise;
let testFranchiseStore;
let adminUser;
let adminUserAuthToken;

beforeAll(async () => {
    adminUser = await createAdminUser();
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';

    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);

    const loginRes = await request(app).put('/api/auth').send(adminUser);
    console.log(loginRes.body)
    adminUserAuthToken = loginRes.body.token;

    testFranchise = { id: 2, name: 'Test Franchise', admins: [{ email: adminUser.email }] };
    testFranchiseStore = { id: 3, name: 'test store', totalRevenue: '0'};
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
test('list all franchises', async () => {
    const listRes = await request(app).get('/api/franchise').set('Authorization', `Bearer ${adminUserAuthToken}`);
    expect(listRes.status).toBe(200);

    expect(Array.isArray(listRes.body)).toBe(true);
});

test('list user franchises', async () => {
    const listUserFranchiseRes = await request(app).get(`/api/franchise/${adminUser.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`);
    expect(listUserFranchiseRes.status).toBe(200);

    expect(Array.isArray(listUserFranchiseRes.body)).toBe(true);
});

test('delete a franchise', async () => {
    const deleteRes = await request(app).delete(`/api/franchise/${testFranchise.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ message: 'franchise deleted' });

});

test('delete a franchise store', async () => {
    const newStore = { name: 'new store', totalRevenue: '0'};
    const createStoreRes = await request(app).delete(`/api/franchise/${testFranchise.id}/store/${testFranchiseStore.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(newStore);

    expect(createStoreRes.status).toBe(200);
});










