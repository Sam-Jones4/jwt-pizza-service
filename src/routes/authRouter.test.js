const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a'};
let testUserAuthToken;
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
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout', async () => {
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(logoutRes.status).toBe(200);

    expect(logoutRes.body).toEqual({ message: 'logout successful'})
});

test('update', async () => {
    const updatedUser = { email: 'updated@test.com', password: 'b'}

    const updateRes = await request(app).put(`/api/auth/${adminUser.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`).send(updatedUser);
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.email).toBe(updatedUser.email);
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