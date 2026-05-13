import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  PaginatedResponse,
  Workshop,
  WorkshopListQuery,
} from '@unihub/types';

const NOW = '2026-05-01T08:00:00.000Z';

const WORKSHOPS: Workshop[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Giao tiếp và thuyết trình trong môi trường chuyên nghiệp',
    speaker: 'TS. Nguyễn Minh An',
    room: 'Phòng họp A501 — nhà HT',
    roomMapUrl: 'https://maps.example.edu/ht-a501',
    startsAt: '2026-05-18T01:00:00.000Z',
    endsAt: '2026-05-18T04:00:00.000Z',
    capacity: 40,
    seatsLeft: 12,
    isPaid: false,
    price: null,
    status: 'published',
    aiSummary: null,
    aiSummaryStatus: 'none',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title: 'Python cho phân tích dữ liệu (hands-on)',
    speaker: 'ThS. Trần Hải Yến',
    room: 'Lab máy tính C203',
    roomMapUrl: null,
    startsAt: '2026-05-19T02:30:00.000Z',
    endsAt: '2026-05-19T06:00:00.000Z',
    capacity: 28,
    seatsLeft: 3,
    isPaid: true,
    price: 150_000,
    status: 'published',
    aiSummary: null,
    aiSummaryStatus: 'none',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    title: 'Định hướng nghề trong ngành CNTT và khoa học dữ liệu',
    speaker: 'Ông Lê Quốc Việt — Tech Lead',
    room: 'Hội trường H',
    roomMapUrl: null,
    startsAt: '2026-05-20T00:30:00.000Z',
    endsAt: '2026-05-20T03:30:00.000Z',
    capacity: 200,
    seatsLeft: 64,
    isPaid: false,
    price: null,
    status: 'published',
    aiSummary: null,
    aiSummaryStatus: 'none',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    title: 'Workshop nội bộ — chưa công bố',
    speaker: 'Ban tổ chức',
    room: 'TBD',
    roomMapUrl: null,
    startsAt: '2026-06-01T01:00:00.000Z',
    endsAt: '2026-06-01T03:00:00.000Z',
    capacity: 30,
    seatsLeft: 30,
    isPaid: false,
    price: null,
    status: 'draft',
    aiSummary: null,
    aiSummaryStatus: 'none',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

@Injectable()
export class WorkshopsService {
  findAll(params: WorkshopListQuery): PaginatedResponse<Workshop> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const search = params.search?.trim().toLowerCase();
    const status = params.status;

    let rows = [...WORKSHOPS];

    if (status) {
      rows = rows.filter((w) => w.status === status);
    }

    if (params.isPaid === true || params.isPaid === false) {
      rows = rows.filter((w) => w.isPaid === params.isPaid);
    }

    if (search) {
      rows = rows.filter((w) => {
        const haystack = `${w.title} ${w.speaker}`.toLowerCase();
        return haystack.includes(search);
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  findOne(id: string): Workshop {
    const workshop = WORKSHOPS.find((w) => w.id === id);
    if (!workshop) {
      throw new NotFoundException('Workshop không tồn tại.');
    }
    return workshop;
  }
}
