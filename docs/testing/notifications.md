# Notification System Testing

## Test Architecture
We use pytest, pytest-django, and Channels test communicator.

## Running Tests
Run pytest to run all tests.
Run pytest --cov for coverage.

## Fixtures
Found in 	ests/fixtures.py and 	ests/conftest.py.

## Mocking Strategy
We mock external APIs and email backends.

## Performance Benchmark Methodology
Testing 1000 concurrent notifications.

## Coverage Requirements
>=95% for Notifications, >=90% for others.
