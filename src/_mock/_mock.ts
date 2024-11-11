import { fSub } from 'src/utils/format-time'

import { CONFIG } from 'src/config-global'

import {
    _id,
    _ages,
    _roles,
    _prices,
    _emails,
    _ratings,
    _nativeS,
    _nativeM,
    _nativeL,
    _percents,
    _booleans,
    _sentences,
    _lastNames,
    _fullNames,
    _tourNames,
    _jobTitles,
    _taskNames,
    _fileNames,
    _postTitles,
    _firstNames,
    _eventNames,
    _courseNames,
    _fullAddress,
    _companyNames,
    _productNames,
    _descriptions,
    _phoneNumbers,
    _countryNames,
} from './assets'

// ----------------------------------------------------------------------

export const _mock = {
    id: (index: number) => _id[index],
    time: (index: number) => fSub({ days: index, hours: index }),
    boolean: (index: number) => _booleans[index],
    role: (index: number) => _roles[index],
    // Text
    courseNames: (index: number) => _courseNames[index],
    fileNames: (index: number) => _fileNames[index],
    eventNames: (index: number) => _eventNames[index],
    taskNames: (index: number) => _taskNames[index],
    postTitle: (index: number) => _postTitles[index],
    jobTitle: (index: number) => _jobTitles[index],
    tourName: (index: number) => _tourNames[index],
    productName: (index: number) => _productNames[index],
    sentence: (index: number) => _sentences[index],
    description: (index: number) => _descriptions[index],
    // Contact
    email: (index: number) => _emails[index],
    phoneNumber: (index: number) => _phoneNumbers[index],
    fullAddress: (index: number) => _fullAddress[index],
    // Name
    firstName: (index: number) => _firstNames[index],
    lastName: (index: number) => _lastNames[index],
    fullName: (index: number) => _fullNames[index],
    companyNames: (index: number) => _companyNames[index],
    countryNames: (index: number) => _countryNames[index],
    // Number
    number: {
        percent: (index: number) => _percents[index],
        rating: (index: number) => _ratings[index],
        age: (index: number) => _ages[index],
        price: (index: number) => _prices[index],
        nativeS: (index: number) => _nativeS[index],
        nativeM: (index: number) => _nativeM[index],
        nativeL: (index: number) => _nativeL[index],
    },
    // Image
    image: {
        cover: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/cover/cover-${index + 1}.webp`,
        avatar: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/avatar/avatar-${index + 1}.webp`,
        travel: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/travel/travel-${index + 1}.webp`,
        course: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/course/course-${index + 1}.webp`,
        company: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/company/company-${index + 1}.webp`,
        product: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/m-product/product-${index + 1}.webp`,
        portrait: (index: number) =>
            `${CONFIG.assetsDir}/assets/images/mock/portrait/portrait-${index + 1}.webp`,
    },
}

export const chart: any = {
    series: [
        {
            name: 'Weekly',
            categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
            data: [
                { name: 'Images', data: [20, 34, 48, 65, 37] },
                { name: 'Media', data: [10, 34, 13, 26, 27] },
                { name: 'Documents', data: [10, 14, 13, 16, 17] },
                { name: 'Other', data: [5, 12, 6, 7, 8] },
            ],
        },
        {
            name: 'Monthly',
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
            data: [
                { name: 'Images', data: [10, 34, 13, 56, 77, 88, 99, 77, 45, 12, 43, 34] },
                { name: 'Media', data: [10, 34, 13, 56, 77, 88, 99, 77, 45, 12, 43, 34] },
                { name: 'Documents', data: [10, 34, 13, 56, 77, 88, 99, 77, 45, 12, 43, 34] },
                { name: 'Other', data: [10, 34, 13, 56, 77, 88, 99, 77, 45, 12, 43, 34] },
            ],
        },
        {
            name: 'Yearly',
            categories: ['2018', '2019', '2020', '2021', '2022', '2023'],
            data: [
                { name: 'Images', data: [24, 34, 32, 56, 77, 48] },
                { name: 'Media', data: [24, 34, 32, 56, 77, 48] },
                { name: 'Documents', data: [24, 34, 32, 56, 77, 48] },
                { name: 'Other', data: [24, 34, 32, 56, 77, 48] },
            ],
        },
    ],
}
