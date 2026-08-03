export type ApplicationType = {
  id: string;
  jobId: string;
  jobTitle: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  contact: string;
  position: string;
  skills: string;
  portfolio: string;
  portfolioType?: 'link' | 'file';
  portfolioFile?: File | null;
  portfolioFileName?: string;
  appliedDateTime: string;
  status: 'Pending' | 'Under Review' | 'For Interview' | 'Approved' | 'Rejected';
  appliedDate: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string;
  rejectionReason?: string;
};

type Subscriber = () => void;

class ApplicationsStore {
  private applications: ApplicationType[] = [
    {
      id: 'APP-001',
      jobId: 'JOB-001',
      jobTitle: 'Part-Time Print Shop Assistant',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      email: 'maria.santos@psu.edu.ph',
      contact: '09171234567',
      position: 'Part-Time Print Shop Assistant',
      skills:
        'I have experience with document preparation and customer service from my previous OJT at a printing shop. I am a 3rd year Business Administration student with flexible availability. Highly organized and fast learner.',
      portfolio: 'https://drive.google.com/maria-santos-resume',
      portfolioType: 'link',
      appliedDateTime: '2026-04-12 09:30 AM',
      status: 'For Interview',
      appliedDate: '2026-04-12',
      interviewDate: '2026-04-16',
      interviewTime: '10:00 AM',
      interviewLocation: 'Room 4, TBI Building, Palawan State University',
    },
    {
      id: 'APP-002',
      jobId: 'JOB-002',
      jobTitle: 'Graphic Designer',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Maria Santos',
      email: 'maria.santos@psu.edu.ph',
      contact: '09171234567',
      position: 'Graphic Designer',
      skills:
        'Proficient in Adobe Photoshop, Illustrator, and Canva. I have designed posters, tarpaulins, and social media graphics for school events. I have a portfolio of 20+ projects.',
      portfolio: 'https://behance.net/mariasantos',
      portfolioType: 'link',
      appliedDateTime: '2026-04-10 02:15 PM',
      status: 'Under Review',
      appliedDate: '2026-04-10',
    },
  ];
  private subscribers: Set<Subscriber> = new Set();

  getApplications(): ApplicationType[] {
    return [...this.applications];
  }

  getApplicationById(id: string): ApplicationType | undefined {
    return this.applications.find((a) => a.id === id);
  }

  getApplicationByJobId(jobId: string): ApplicationType | undefined {
    return this.applications.find((a) => a.jobId === jobId);
  }

  addApplication(app: Omit<ApplicationType, 'id' | 'status' | 'appliedDate' | 'appliedDateTime'>): ApplicationType {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const newApp: ApplicationType = {
      ...app,
      id: `APP-${String(this.applications.length + 1).padStart(3, '0')}`,
      status: 'Pending',
      appliedDate: dateStr,
      appliedDateTime: `${dateStr} ${timeStr}`,
    };
    this.applications = [...this.applications, newApp];
    this.notify();
    return newApp;
  }

  updateStatus(id: string, status: ApplicationType['status']): void {
    this.applications = this.applications.map((a) =>
      a.id === id ? { ...a, status } : a
    );
    this.notify();
  }

  updateApplication(id: string, updates: Partial<ApplicationType>): void {
    this.applications = this.applications.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );
    this.notify();
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }
}

export const applicationsStore = new ApplicationsStore();
