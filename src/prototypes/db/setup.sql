-- Replace 'your_password_here' with a secure password
CREATE ROLE levelup_app LOGIN PASSWORD 'your_password_here';

CREATE DATABASE levelup
    OWNER levelup_app
    ENCODING 'UTF8'
    TEMPLATE template0;