import { useEffect } from 'react';

export function isValidPhone(phone) {
    if (!phone || phone.trim() === '') {
        return true;
    }

    const regex = /^(?:\+61|0)4\d{8}$/;
    return regex.test(phone);
}

export function isValidEmail(email) {
    if (!email || email.trim() === '') {
        return true;
    }

    const regex = /^(?![.-])[A-Za-z0-9._%+-]+(?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/;
    return regex.test(email);
}