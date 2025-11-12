"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import Image from "next/image";
import dynamic from 'next/dynamic';
// Note: You might need to install a chart library like ApexCharts and its React wrapper
// npm install react-apexcharts apexcharts
// For this example, we'll structure the code assuming it's available.
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const dummyEvents = [
  {
    id: 1,
    title: 'Annual Tech Conference',
    date: '2024-10-26',
    location: 'Convention Center, New York',
  },
  {
    id: 2,
    title: 'Marketing Summit 2024',
    date: '2024-11-15',
    location: 'Grand Hall, London',
  },
  {
    id: 3,
    title: 'Product Launch Gala',
    date: '2024-12-01',
    location: 'The Waterfront, San Francisco',
  },
  {
    id: 4,
    title: 'Team Building Retreat',
    date: '2025-01-20',
    location: 'Mountain Resort, Aspen',
  },
];

const dummyBookings = [
  { id: 1, booker: "Ana Smith", booked: "John Doe", for: "Project Kickoff", avatar: "/assets/img/avatars/2.png" },
  { id: 2, booker: "Peter Jones", booked: "Mary Jane", for: "Marketing Sync", avatar: "/assets/img/avatars/4.png" },
  { id: 3, booker: "John Doe", booked: "Ana Smith", for: "Design Review", avatar: "/assets/img/avatars/3.png" },
  { id: 4, booker: "Mary Jane", booked: "Peter Jones", for: "1-on-1", avatar: "/assets/img/avatars/5.png" },
];

const dummyMembers = [
  { id: 1, name: "John Doe", status: "Available", avatar: "/assets/img/avatars/3.png" },
  { id: 2, name: "Mary Jane", status: "In a meeting", avatar: "/assets/img/avatars/5.png" },
  { id: 3, name: "Peter Jones", status: "Available", avatar: "/assets/img/avatars/4.png" },
  { id: 4, name: "Ana Smith", status: "Away", avatar: "/assets/img/avatars/2.png" },
];

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/me');
        if (!response.ok) {
          router.push('/AdminLogin');
        }
      } catch (error) {
        router.push('/AdminLogin');
      }
    };
    checkAuth();
  }, [router]);

  // Chart data for Appointments Overview
  const appointmentChartData = {
    series: [{
      name: 'Appointments',
      data: [30, 40, 35, 50, 49, 60, 70, 91, 125, 100, 110, 130] // Example data for 12 months
    }],
    options: {
      chart: {
        height: 280,
        type: 'line',
        toolbar: {
          show: false
        }
      },
      stroke: {
        curve: 'smooth',
        width: 3,
        colors: ['#696cff'] // Primary color from theme
      },
      xaxis: {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        labels: {
          style: {
            colors: '#6f6b7d', // labelColor
            fontSize: '13px',
            fontFamily: 'Inter'
          }
        },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#6f6b7d', // labelColor
            fontSize: '13px',
            fontFamily: 'Inter'
          }
        }
      },
      tooltip: { enabled: true, theme: 'dark' }
    }
  };
  return (
    <div className="container-xxl flex-grow-1 container-p-y">
      <div className="row gy-4">
        {/* Congratulations Card */}
        {/* <div className="col-lg-12">
          <div className="card">
            <div className="card-body">
              <h4 className="card-title mb-1">Congratulations, Admin! 🎉</h4>
              <p className="pb-0">You have 72% more sales today.</p>
              <h4 className="text-primary mb-1">$42.8k</h4>
              <p className="mb-2 pb-1">Check your new badge in your profile.</p>
              <a href="#" className="btn btn-sm btn-primary">View Badges</a>
            </div>
            <Image
              src="/assets/img/illustrations/trophy.png"
              className="position-absolute bottom-0 end-0 me-3"
              height="140"
              width="83"
              alt="Trophy"
            />
          </div>
        </div> */}

        {/* Statistics */}
        <div className="col-lg-12">
          <div className="card">
            <div className="card-header">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="card-title m-0 me-2">Statistics</h5>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3 col-6">
                  <div className="d-flex align-items-center">
                    <div className="avatar">
                      <div className="avatar-initial bg-label-primary rounded">
                        <i className="ri-calendar-check-line ri-24px"></i>
                      </div>
                    </div>
                    <div className="ms-3">
                      <div className="small mb-1">Total Appointments</div>
                      <h5 className="mb-0">1.2k</h5>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="d-flex align-items-center">
                    <div className="avatar">
                      <div className="avatar-initial bg-label-success rounded">
                        <i className="ri-user-follow-line ri-24px"></i>
                      </div>
                    </div>
                    <div className="ms-3">
                      <div className="small mb-1">Active Members</div>
                      <h5 className="mb-0">458</h5>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="d-flex align-items-center">
                    <div className="avatar">
                      <div className="avatar-initial bg-label-warning rounded">
                        <i className="ri-calendar-event-line ri-24px"></i>
                      </div>
                    </div>
                    <div className="ms-3">
                      <div className="small mb-1">Upcoming Events</div>
                      <h5 className="mb-0">4</h5>
                    </div>
                  </div>
                </div>
                <div className="col-md-3 col-6">
                  <div className="d-flex align-items-center">
                    <div className="avatar">
                      <div className="avatar-initial bg-label-info rounded">
                        <i className="ri-time-line ri-24px"></i>
                      </div>
                    </div>
                    <div className="ms-3">
                      <div className="small mb-1">Pending Requests</div>
                      <h5 className="mb-0">12</h5>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title m-0">Upcoming Events</h5>
            </div>
            <div className="table-responsive text-nowrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="table-border-bottom-0">
                  {dummyEvents.slice(0, 4).map(event => (
                    <tr key={event.id}>
                      <td>
                        <span className="fw-medium">{event.title}</span>
                      </td>
                      <td>{event.location}</td>
                      <td>{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <a href="/Events" className="btn btn-sm btn-text-secondary">
                          <i className="ri-eye-line"></i>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="col-lg-4 col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="card-title m-0 me-2">Recent Bookings</h5>
            </div>
            <div className="card-body">
              <ul className="list-unstyled mb-0">
                {dummyBookings.map((booking, index) => (
                  <li key={booking.id} className={`d-flex ${index < 3 ? 'mb-4' : ''}`}>
                    <div className="avatar flex-shrink-0 me-3">
                      <Image src={booking.avatar} alt={booking.booker} width={38} height={38} className="rounded-circle" />
                    </div>
                    <div className="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">
                      <div className="me-2">
                        <h6 className="mb-0">{booking.booker}</h6>
                        <small className="text-muted">booked {booking.booked}</small>
                      </div>
                      <div className="user-progress">
                        <small className="fw-medium">{booking.for}</small>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Appointments Overview Chart */}
       <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Appointments Overview</h5>
            </div>
            <div className="card-body">
              <Chart options={appointmentChartData.options} series={appointmentChartData.series} type="line" height={280} />
            </div>
          </div>
        </div>

        {/* Available Members */}
        <div className="col-lg-4 col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="card-title m-0 me-2">Available Members</h5>
            </div>
            <div className="card-body">
              <ul className="list-unstyled mb-0">
                {dummyMembers.map((member, idx) => (
                  <li key={member.id} className={`d-flex align-items-center ${idx < 3 ? "mb-4" : ""}`}>
                    <div className="avatar flex-shrink-0 me-3">
                      <Image src={member.avatar} alt={member.name} width={38} height={38} className="rounded-circle" />
                    </div>
                    <div className="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">
                      <div className="me-2">
                        <h6 className="mb-0">{member.name}</h6>
                      </div>
                      <div className="user-progress">
                        <small className={`text-${member.status === 'Available' ? 'success' : 'warning'}`}>{member.status}</small>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
