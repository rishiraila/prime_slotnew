"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import Image from "next/image";
import dynamic from 'next/dynamic';
// Note: You might need to install a chart library like ApexCharts and its React wrapper
// npm install react-apexcharts apexcharts
// For this example, we'll structure the code assuming it's available.
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState({});
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({
    totalAppointments: 0,
    activeMembers: 0,
    upcomingEvents: 0,
    pendingRequests: 0
  });
  const [chartData, setChartData] = useState({
    series: [{ name: 'Appointments', data: [] }],
    options: {
      chart: { height: 280, type: 'line', toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 3, colors: ['#696cff'] },
      xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
      yaxis: { labels: { style: { colors: '#6f6b7d', fontSize: '13px', fontFamily: 'Inter' } } },
      tooltip: { enabled: true, theme: 'dark' }
    }
  });

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, membersRes, meetingsRes] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/members'),
          fetch('/api/meetings')
        ]);

        const eventsData = eventsRes.ok ? await eventsRes.json() : { records: [] };
        const membersData = membersRes.ok ? await membersRes.json() : { records: [] };
        const meetingsData = meetingsRes.ok ? await meetingsRes.json() : { records: [] };

        const eventsList = eventsData.records || [];
        const membersList = membersData.records || [];
        const meetingsList = meetingsData.records || [];

        const membersMap = {};
        membersList.forEach(m => membersMap[m.id] = m);

        setEvents(eventsList);
        setMembers(membersMap);
        setMeetings(meetingsList);

        // Compute stats
        const now = Date.now();
        const upcomingEventsCount = eventsList.filter(e => e.date >= now).length;
        const activeMembersCount = membersList.filter(m => m.memberStatus === 'Active').length;
        const totalAppointments = meetingsList.length;
        const pendingRequests = meetingsList.filter(m => m.status === 'scheduled' || m.status === 'pending').length;

        setStats({
          totalAppointments,
          activeMembers: activeMembersCount,
          upcomingEvents: upcomingEventsCount,
          pendingRequests
        });

        // Compute chart data: appointments per month
        const monthlyCounts = Array(12).fill(0);
        meetingsList.forEach(m => {
          const date = new Date(m.scheduledAt);
          const month = date.getMonth();
          monthlyCounts[month]++;
        });
        setChartData(prev => ({
          ...prev,
          series: [{ ...prev.series[0], data: monthlyCounts }]
        }));

      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

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
                      <h5 className="mb-0">{stats.totalAppointments}</h5>
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
                      <h5 className="mb-0">{stats.activeMembers}</h5>
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
                      <h5 className="mb-0">{stats.upcomingEvents}</h5>
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
                      <h5 className="mb-0">{stats.pendingRequests}</h5>
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
                  {events.slice(0, 4).map(event => (
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
              <h5 className="card-title m-0 me-2">Recent Meetings</h5>
            </div>
            <div className="card-body">
              <ul className="list-unstyled mb-0">
                {meetings.slice(0, 4).map((meeting, index) => (
                  <li key={meeting.id} className={`d-flex ${index < 3 ? 'mb-4' : ''}`}>
                    <div className="avatar flex-shrink-0 me-3">
                      <Image src={members[meeting.aId]?.avatar || '/assets/img/avatars/1.png'} alt={members[meeting.aId]?.fullName || 'Unknown'} width={38} height={38} className="rounded-circle" />
                    </div>
                    <div className="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">
                      <div className="me-2">
                        <h6 className="mb-0">{members[meeting.aId]?.fullName || 'Unknown'}</h6>
                        <small className="text-muted">booked {members[meeting.bId]?.fullName || 'Unknown'}</small>
                      </div>
                      <div className="user-progress">
                        <small className="fw-medium">{meeting.topic || 'Meeting'}</small>
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
              <Chart options={chartData.options} series={chartData.series} type="line" height={280} />
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
                {Object.values(members).slice(0, 4).map((member, idx) => (
                  <li key={member.id} className={`d-flex align-items-center ${idx < 3 ? "mb-4" : ""}`}>
                    <div className="avatar flex-shrink-0 me-3">
                      <Image src={member.avatar || '/assets/img/avatars/1.png'} alt={member.fullName} width={38} height={38} className="rounded-circle" />
                    </div>
                    <div className="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">
                      <div className="me-2">
                        <h6 className="mb-0">{member.fullName}</h6>
                      </div>
                      <div className="user-progress">
                        <small className={`text-${member.memberStatus === 'Active' ? 'success' : 'warning'}`}>{member.memberStatus}</small>
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
