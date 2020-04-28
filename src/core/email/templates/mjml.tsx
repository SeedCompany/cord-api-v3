import { MjmlTitle } from 'mjml-react';
import * as React from 'react';
import { createContext, useContext } from 'react';

// Re-export all mjml components without the stupid prefix
export {
  MjmlAll as All,
  MjmlClass as Class,
  MjmlAccordion as Accordion,
  MjmlAccordionElement as AccordionElement,
  MjmlAccordionText as AccordionText,
  MjmlAccordionTitle as AccordionTitle,
  MjmlAttributes as Attributes,
  MjmlBody as Body,
  MjmlButton as Button,
  MjmlBreakpoint as Breakpoint,
  MjmlCarousel as Carousel,
  MjmlCarouselImage as CarouselImage,
  MjmlColumn as Column,
  MjmlDivider as Divider,
  MjmlFont as Font,
  MjmlGroup as Group,
  MjmlHead as Head,
  MjmlHero as Hero,
  MjmlImage as Image,
  MjmlNavbar as Navbar,
  MjmlNavbarLink as NavbarLink,
  MjmlPreview as Preview,
  MjmlRaw as Raw,
  MjmlSection as Section,
  MjmlSocial as Social,
  MjmlSocialElement as SocialElement,
  MjmlSpacer as Spacer,
  MjmlStyle as Style,
  MjmlTable as Table,
  MjmlText as Text,
  MjmlWrapper as Wrapper,
  Mjml,
} from 'mjml-react';

export interface MjmlContext {
  title?: string;
}

export const RenderContext = createContext<MjmlContext>({});

export const Title = ({ children }: { children: string }) => {
  const context = useContext(RenderContext);
  context.title = children;
  return <MjmlTitle>{children}</MjmlTitle>;
};
