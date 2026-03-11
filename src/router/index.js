import { createRouter, createWebHistory } from 'vue-router';

const HomePage = () => import('../pages/HomePage.vue');
const ExperimentsPage = () => import('../pages/ExperimentsPage.vue');
const ExperimentDetailPage = () => import('../pages/ExperimentDetailPage.vue');
const ComparePage = () => import('../pages/ComparePage.vue');
const StructurePage = () => import('../pages/StructurePage.vue');
const AboutPage = () => import('../pages/AboutPage.vue');
const DataPage = () => import('../pages/DataPage.vue');
const CitationPage = () => import('../pages/CitationPage.vue');
const ReleasePage = () => import('../pages/ReleasePage.vue');
const NotFoundPage = () => import('../pages/NotFoundPage.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/experiments', name: 'experiments', component: ExperimentsPage },
    { path: '/exp/:expId', name: 'experiment-detail', component: ExperimentDetailPage, props: true },
    { path: '/compare', name: 'compare', component: ComparePage },
    { path: '/structure/:expId', name: 'structure', component: StructurePage, props: true },
    { path: '/about', name: 'about', component: AboutPage },
    { path: '/data', name: 'data', component: DataPage },
    { path: '/citation', name: 'citation', component: CitationPage },
    { path: '/release', name: 'release', component: ReleasePage },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundPage },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
